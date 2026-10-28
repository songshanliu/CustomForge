import {
  ActiveSelection,
  Canvas,
  FabricImage,
  Point,
  Textbox,
  util,
  type CanvasEvents,
  type FabricObject,
  type Transform,
} from 'fabric'
import { parseDesignDocument } from '../core/design'
import { resolveRestoredPrintMapping } from '../core/printMapping'
import { PrintSurfaceError } from '../core/printErrors'
import type {
  AddImageOptions,
  AddTextOptions,
  CanvasBounds,
  DesignCanvas as DesignCanvasSize,
  DesignImageRole,
  DesignDocument,
  DesignPrintMapping,
  DesignObject,
  DesignObjectTransform,
  EditorAppearance,
  EditorViewOptions,
  EditorViewState,
  HistoryState,
  ImageDesignObject,
  ObjectBoundaryOptions,
  TextAlignment,
  TextDesignObject,
  TextFontStyle,
  TextFontWeight,
  UpdateObjectTransformOptions,
  UpdateTextOptions,
} from '../core/types'
import type { UvLayout } from '../core/uv'
import { DesignHistory } from './DesignHistory'
import {
  calculateContainmentOffset,
  calculateContainmentScale,
} from './objectBounds'
import { calculateUvCanvasBounds, calculateUvViewBounds } from './uvBounds'
import { resolvePersistentImageSource } from './imageSource'
import { createUvOverlayPaths, renderUvOverlay, type UvOverlayPaths } from './uvOverlay'
import { calculateEditorView, hasEditorViewBounds, normalizeEditorViewOptions } from './editorView'
import { boundedObjects, captureGeometry, constrainCandidate, installStableTransform, liveBounds, normalizeObjectBoundaryOptions, validGeometry } from './objectBoundary'

interface NormalizedEditorAppearance {
  selectionFill: string
  selectionBorder: string
  controlFill: string
  controlBorder: string
  objectBorder: string
  controlSize: number
  uvFill?: string
  uvBoundary: string
}

function normalizeEditorAppearance(
  appearance: EditorAppearance = {},
): NormalizedEditorAppearance {
  const controlSize = appearance.controlSize ?? 8
  if (!Number.isFinite(controlSize) || controlSize <= 0) {
    throw new RangeError('appearance.editor.controlSize must be greater than zero')
  }

  return {
    selectionFill: appearance.selectionFill?.trim() || 'rgba(19, 113, 125, 0.12)',
    selectionBorder: appearance.selectionBorder?.trim() || '#13717d',
    controlFill: appearance.controlFill?.trim() || '#ffffff',
    controlBorder: appearance.controlBorder?.trim() || '#13717d',
    objectBorder: appearance.objectBorder?.trim() || '#13717d',
    controlSize,
    uvFill: appearance.uvFill?.trim() || undefined,
    uvBoundary: appearance.uvBoundary?.trim() || '#dc2626',
  }
}

/** 二维编辑器内部初始化配置 */
interface DesignEditorOptions {
  /** 创建和恢复时共用的边界策略 */
  objectBoundary?: ObjectBoundaryOptions
  /** 仅影响显示的取景配置 */
  editorView?: EditorViewOptions
  /** 三维共用的已解析映射 */
  printMapping?: DesignPrintMapping
  /** 宿主为实际模型提供的内容版本，不从待恢复文档推断 */
  modelRevision?: string
  /** 是否使用 Schema 2 保存 */
  usesMappingDocument?: boolean
  /** 当前是否允许无映射的 Schema 1 恢复，默认 true */
  legacyMapping?: boolean
  /** 画布逻辑宽度，单位为像素 */
  width: number

  /** 画布逻辑高度，单位为像素 */
  height: number

  /** 最多保留的撤销步骤数量 */
  historyLimit: number

  /** 编辑画布的无障碍名称 */
  ariaLabel?: string

  /** 未提供内容时添加到画布的默认文字 */
  defaultText?: string

  /** 空文字对象的默认名称 */
  textObjectName?: string

  /** 普通图片对象的默认名称 */
  imageObjectName?: string

  /** 背景图片对象的默认名称 */
  backgroundObjectName?: string

  /** 选择框、对象控制点和 UV 辅助层外观 */
  appearance?: EditorAppearance
}

type RenderListener = () => void
type SelectionListener = (objectIds: string[]) => void
type HistoryListener = (state: HistoryState) => void

/** 将 Fabric 主画布重绘为不含选择框的实时纹理 */
class DesignCanvas extends Canvas {
  private texturePass = false

  /** 使用当前屏幕 DPR，避免 Fabric 模块初始化时固定的设备比例 */
  override getRetinaScaling(): number {
    return this.enableRetinaScaling ? Math.max(window.devicePixelRatio || 1, 1) : 1
  }

  /** 内部纹理输出不对交互监听者暴露临时尺寸或渲染事件 */
  override fire<K extends keyof CanvasEvents>(name: K, options?: CanvasEvents[K]): void {
    if (this.texturePass && (name === 'before:render' || name === 'after:render')) return
    super.fire(name, options)
  }

  /** 将纯设计内容绘制到稳定的纹理 Canvas */
  renderTexture(context: CanvasRenderingContext2D, width: number, height: number): void {
    const previous = {
      viewportTransform: this.viewportTransform, width: this.width, height: this.height,
      enableRetinaScaling: this.enableRetinaScaling, skipOffscreen: this.skipOffscreen,
      skipControlsDrawing: this.skipControlsDrawing, texturePass: this.texturePass,
    }
    const editing = this.getObjects().filter((object): object is Textbox => object instanceof Textbox && object.isEditing)
    this.texturePass = true
    this.viewportTransform = [1, 0, 0, 1, 0, 0]
    this.width = width
    this.height = height
    this.enableRetinaScaling = false
    this.skipOffscreen = false
    this.skipControlsDrawing = true
    editing.forEach((object) => { object.isEditing = false })
    context.save()
    try {
      context.setTransform(1, 0, 0, 1, 0, 0)
      this.renderCanvas(context, this.getObjects())
    } catch (error) {
      // 失败的对象渲染可能留下未配对的 context.save，重置仅用于纹理的 backing store
      context.canvas.width = width
      throw error
    } finally {
      context.restore()
      Object.assign(this, previous)
      editing.forEach((object) => { object.isEditing = true })
      this.calcViewportBoundaries()
    }
  }
}

/**
 * 基于 Fabric.js 的二维纹理编辑器
 *
 * 负责基础纹理、UV 区域辅助层、文字、图片、对象选择和 PNG 导出
 * 显示尺寸可以响应容器变化，内部逻辑尺寸保持不变
 */
export class DesignEditor {
  /** 当前实例使用的 Fabric Canvas */
  readonly canvas: Canvas

  private readonly host: HTMLElement
  private readonly width: number
  private readonly height: number
  private readonly defaultText: string
  private readonly textObjectName: string
  private readonly imageObjectName: string
  private readonly backgroundObjectName: string
  private readonly appearance: NormalizedEditorAppearance
  private readonly objectBoundary: Required<ObjectBoundaryOptions>
  private constrainTransformEvent?: (transform: Transform) => void
  private editableBounds: CanvasBounds
  private actualPrintableBounds: CanvasBounds = { left: 0, top: 0, width: 0, height: 0 }
  private readonly editorViewOptions: Required<EditorViewOptions>
  private editorViewState: EditorViewState
  private readonly editorViewListeners = new Set<(state: EditorViewState) => void>()
  private readonly textureListeners = new Set<RenderListener>()
  private readonly paper: HTMLDivElement
  private uvPaths?: UvOverlayPaths
  private resizeFrame = 0
  private displayDpr = 0
  private dprQuery?: MediaQueryList
  private contentDirty = true
  private textureDirty = true
  private textureNotificationPending = true
  private readonly scheduleDisplayResize = () => {
    if (!this.destroyed && !this.resizeFrame) this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0
      this.resizeDisplay()
    })
  }
  private readonly renderListeners = new Set<RenderListener>()
  private readonly selectionListeners = new Set<SelectionListener>()
  private readonly historyListeners = new Set<HistoryListener>()
  private readonly objectIds = new WeakMap<FabricObject, string>()
  private readonly objectsById = new Map<string, FabricObject>()
  private readonly objectNames = new WeakMap<FabricObject, string>()
  private readonly objectLocks = new WeakMap<FabricObject, boolean>()
  private readonly usedObjectIds = new Set<string>()
  private readonly imageSources = new WeakMap<FabricImage, string>()
  private readonly imageRoles = new WeakMap<FabricImage, DesignImageRole>()
  private readonly resizeObserver: ResizeObserver
  private readonly history: DesignHistory<DesignDocument>
  private readonly uvOverlay: HTMLCanvasElement
  private readonly textureRenderer: DesignCanvas
  private readonly textureCanvasElement: HTMLCanvasElement
  private readonly textureContext: CanvasRenderingContext2D
  private historySignature: string
  private historyTimer?: ReturnType<typeof setTimeout>
  private historyBusy = false
  private renderingTexture = false
  private objectIdSequence = 0
  private printMapping?: DesignPrintMapping
  private restoredPrintMapping?: DesignPrintMapping
  private modelRevision?: string
  private persistMapping = false
  private legacyMapping = true
  private destroyed = false
  private contentGeneration = 0

  /**
   * @param host 二维编辑器挂载容器
   * @param options 画布逻辑尺寸和历史容量
   */
  constructor(host: HTMLElement, options: DesignEditorOptions) {
    this.host = host
    this.width = options.width
    this.height = options.height
    this.printMapping = options.printMapping
    this.modelRevision = options.modelRevision
    this.persistMapping = options.usesMappingDocument ?? false
    this.legacyMapping = options.legacyMapping ?? true
    this.defaultText = options.defaultText ?? 'Edit this text'
    this.textObjectName = options.textObjectName ?? 'Text'
    this.imageObjectName = options.imageObjectName ?? 'Image'
    this.backgroundObjectName = options.backgroundObjectName ?? 'Background'
    this.appearance = normalizeEditorAppearance(options.appearance)
    this.objectBoundary = normalizeObjectBoundaryOptions(options.objectBoundary)
    this.editorViewOptions = normalizeEditorViewOptions(options.editorView)
    this.editorViewState = calculateEditorView({ width: this.width, height: this.height }, this.actualPrintableBounds, { width: 0, height: 0 }, this.editorViewOptions)
    this.editableBounds = {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
    }

    const element = document.createElement('canvas')
    element.setAttribute('aria-label', options.ariaLabel ?? 'UV texture editor')
    host.replaceChildren(element)

    const canvas = new DesignCanvas(element, {
      width: this.width,
      height: this.height,
      preserveObjectStacking: true,
      selectionColor: this.appearance.selectionFill,
      selectionBorderColor: this.appearance.selectionBorder,
    })
    this.canvas = canvas
    this.textureRenderer = canvas
    this.textureCanvasElement = document.createElement('canvas')
    this.textureCanvasElement.width = this.width
    this.textureCanvasElement.height = this.height
    const textureContext = this.textureCanvasElement.getContext('2d')
    if (!textureContext) {
      canvas.dispose()
      throw new Error('Unable to create the live texture canvas')
    }
    this.textureContext = textureContext
    const initialDesign = this.saveDesign()
    this.history = new DesignHistory(initialDesign, options.historyLimit)
    this.historySignature = JSON.stringify(initialDesign)

    this.canvas.wrapperEl.classList.add('customforge-design-canvas')
    this.paper = document.createElement('div')
    this.paper.className = 'customforge-editor-paper'
    this.paper.setAttribute('aria-hidden', 'true')
    this.canvas.wrapperEl.prepend(this.paper)
    this.uvOverlay = document.createElement('canvas')
    this.uvOverlay.width = this.width
    this.uvOverlay.height = this.height
    this.uvOverlay.className = 'customforge-uv-layout'
    this.uvOverlay.setAttribute('aria-hidden', 'true')
    this.uvOverlay.hidden = true
    this.canvas.wrapperEl.insertBefore(
      this.uvOverlay,
      this.canvas.upperCanvasEl,
    )
    this.canvas.on('after:render', () => {
      if (this.renderingTexture) {
        return
      }

      this.renderTextureCanvas()
      if (this.textureNotificationPending) {
        this.textureNotificationPending = false
        this.textureListeners.forEach((listener) => listener())
      }
      if (this.contentDirty) {
        this.contentDirty = false
        this.renderListeners.forEach((listener) => listener())
      }
    })

    const notifySelection = () => this.notifySelectionChange()

    this.canvas.on('selection:created', notifySelection)
    this.canvas.on('selection:updated', notifySelection)
    this.canvas.on('selection:cleared', notifySelection)

    this.canvas.on('before:transform', ({ transform }) => {
      this.flushHistoryCommit()
      this.constrainTransformEvent = installStableTransform(transform, (start, anchor, action) => {
        if (action === 'drag') this.constrainMovement(transform.target)
        else constrainCandidate(transform.target, start, this.width, this.height, this.allowsOverflow, anchor)
      }, () => this.markContentChanged())
    })
    const constrainTarget = ({ transform }: { transform: Transform }) => {
      this.constrainTransformEvent?.(transform)
    }
    this.canvas.on('object:moving', constrainTarget)
    this.canvas.on('object:scaling', constrainTarget)
    this.canvas.on('object:rotating', constrainTarget)
    this.canvas.on('object:skewing', constrainTarget)
    this.canvas.on('object:resizing', constrainTarget)
    this.canvas.on('object:modified', () => {
      this.constrainTransformEvent = undefined
      this.commitHistory()
    })
    this.canvas.on('mouse:up', () => { this.constrainTransformEvent = undefined })
    this.canvas.on('text:changed', ({ target }) => {
      this.constrainObjectToCanvas(target)
      this.scheduleHistoryCommit()
    })

    this.canvas.on('object:added', () => this.markContentChanged())
    this.canvas.on('object:removed', () => this.markContentChanged())
    this.resizeObserver = new ResizeObserver(this.scheduleDisplayResize)
    try {
      this.resizeObserver.observe(host, { box: 'device-pixel-content-box' })
    } catch {
      this.resizeObserver.observe(host)
    }
    window.addEventListener('resize', this.scheduleDisplayResize)
    this.observeDpr()
    this.resizeDisplay()
  }

  /** 供 Three.js 创建 CanvasTexture 的纯设计画布，不包含选择框和变换控件 */
  get textureCanvas(): HTMLCanvasElement {
    return this.textureCanvasElement
  }

  /**
   * 在交互画布上显示目标 Mesh 的 UV 可打印区域，但不写入实时纹理或导出图片
   *
   * @param layout 从当前目标 Mesh 提取的 UV 布局
   * @param flipY 是否按照垂直翻转后的纹理方向显示
   * @param legacyMapping 是否保留原始模式的历史边界回退，默认 true
   */
  setUvLayout(layout: UvLayout, flipY: boolean, legacyMapping = true): void {
    this.editableBounds = calculateUvCanvasBounds(
      layout,
      flipY,
      this.width,
      this.height,
      legacyMapping,
    )
    this.actualPrintableBounds = calculateUvViewBounds(layout, flipY, this.width, this.height)
    this.uvPaths = createUvOverlayPaths(layout, flipY, this.width, this.height, legacyMapping)
    this.uvOverlay.hidden = !hasEditorViewBounds(this.actualPrintableBounds)
    this.resizeDisplay(true)
  }

  /**
   * 更新产品映射契约，不迁移已有对象；提交产品后须重设历史起点
   *
   * @param mapping 三维共用的数值映射
   * @param usesMappingDocument 是否需要 Schema 2
   * @param legacyMapping 是否允许恢复 Schema 1
   * @param modelRevision 宿主为新产品提供的内容版本，不继承之前设计声明的版本
   */
  setPrintMapping(mapping: DesignPrintMapping, usesMappingDocument: boolean, legacyMapping: boolean, modelRevision?: string): void {
    this.contentGeneration += 1
    this.printMapping = { ...mapping, domain: { ...mapping.domain } }
    this.restoredPrintMapping = undefined
    this.modelRevision = modelRevision
    this.persistMapping = usesMappingDocument
    this.legacyMapping = legacyMapping
  }

  /** 当前快照是否需要携带已解析映射 */
  get usesMappingDocument(): boolean {
    return this.persistMapping
  }

  /** 返回最近成功恢复文档的映射副本，未恢复 Schema 2 或已切换产品时返回 undefined */
  getRestoredPrintMapping(): DesignPrintMapping | undefined {
    const mapping = this.restoredPrintMapping
    return mapping ? { ...mapping, domain: { ...mapping.domain } } : undefined
  }

  /** 当前画布中设计对象的数量，不包含产品基础纹理 */
  get objectCount(): number {
    return this.canvas.getObjects().length
  }

  /**
   * 订阅设计内容或图层状态变更，选择和取景不会触发
   *
   * @param listener 设计变更完成显示后调用的函数
   * @returns 用于取消本次订阅的函数
   */
  onRender(listener: RenderListener): () => void {
    this.renderListeners.add(listener)
    return () => this.renderListeners.delete(listener)
  }

  /** 订阅纯设计纹理更新，不包含选择或显示取景 */
  onTextureRender(listener: RenderListener): () => void {
    this.textureListeners.add(listener)
    return () => this.textureListeners.delete(listener)
  }

  /** 订阅二维取景状态变化，返回取消订阅函数 */
  onEditorViewChange(listener: (state: EditorViewState) => void): () => void {
    this.editorViewListeners.add(listener)
    return () => this.editorViewListeners.delete(listener)
  }

  /** 返回不含可变矩阵引用的二维取景快照 */
  getEditorViewState(): EditorViewState {
    return structuredClone(this.editorViewState)
  }

  /** 主动重新测量容器并取景，隐藏时保留最后有效变换 */
  fitEditorView(): void {
    this.resizeDisplay()
    // 同一帧内隐藏再显示可能不产生新的 ResizeObserver 尺寸记录，补一次延后测量
    const { viewport, minPadding } = this.editorViewState
    if (viewport.width <= 2 * minPadding || viewport.height <= 2 * minPadding) this.scheduleDisplayResize()
  }

  /**
   * 订阅画布选中状态变化
   *
   * @param listener 接收当前选中对象 ID 的函数
   * @returns 用于取消本次订阅的函数
   */
  onSelectionChange(listener: SelectionListener): () => void {
    this.selectionListeners.add(listener)
    return () => this.selectionListeners.delete(listener)
  }

  /**
   * 订阅撤销与重做可用状态变化
   *
   * @param listener 接收最新历史状态的函数
   * @returns 用于取消本次订阅的函数
   */
  onHistoryChange(listener: HistoryListener): () => void {
    this.historyListeners.add(listener)
    return () => this.historyListeners.delete(listener)
  }

  /** 当前是否存在可以撤销的设计快照 */
  get canUndo(): boolean {
    return this.history.state.canUndo
  }

  /** 当前是否存在可以重做的设计快照 */
  get canRedo(): boolean {
    return this.history.state.canRedo
  }

  /**
   * 返回当前对象的独立 Design JSON 快照
   *
   * @returns 按画布层级从后到前排列的对象数组
   */
  getObjects(): DesignObject[] {
    return this.canvas.getObjects().map((object) => this.serializeObject(object))
  }

  /** 返回当前逻辑画布尺寸 */
  getCanvasSize(): DesignCanvasSize {
    return { width: this.width, height: this.height }
  }

  /** 返回当前 UV 可打印区域的独立包围框 */
  getPrintableBounds(): CanvasBounds {
    return { ...this.editableBounds }
  }

  /** 当前选中对象的 ID，按画布层级从后到前排列 */
  getSelectedObjectIds(): string[] {
    return this.canvas
      .getActiveObjects()
      .map((object) => this.objectIds.get(object))
      .filter((id): id is string => Boolean(id))
  }

  /**
   * 按稳定 ID 选中一个可见对象
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到并选中了对象
   */
  selectObject(id: string): boolean {
    return this.selectObjects([id])
  }

  /**
   * 按稳定 ID 同时选中多个可见对象
   *
   * 所有 ID 都必须有效且对象可见，否则保持原选区不变
   *
   * @param ids 对象 ID，空数组表示清除选区
   * @returns 是否应用了请求的选区
   */
  selectObjects(ids: readonly string[]): boolean {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) {
      return this.clearSelection()
    }

    const objects = uniqueIds.map((id) => this.objectsById.get(id))
    if (objects.some((object) => !object || !object.visible)) {
      return false
    }

    this.applySelection(objects as FabricObject[])
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    return true
  }

  /**
   * 清除当前画布选区，不修改设计内容或历史记录
   *
   * @returns 清除前是否存在选中对象
   */
  clearSelection(): boolean {
    if (!this.canvas.getActiveObject()) {
      return false
    }

    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    return true
  }

  /**
   * 按稳定 ID 删除一个对象
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到并删除了对象
   */
  removeObject(id: string): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    if (!object) {
      return false
    }

    if (this.canvas.getActiveObjects().includes(object)) {
      this.canvas.discardActiveObject()
    }
    this.canvas.remove(object)
    this.unregisterObject(object)
    object.dispose()
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.commitHistory()
    return true
  }

  /**
   * 将对象移动到指定图层索引
   *
   * @param id Design JSON 中的对象 ID
   * @param index 从 0 开始的索引，0 表示最底层
   * @returns 对象层级是否发生变化
   */
  moveObject(id: string, index: number): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    const objects = this.canvas.getObjects()
    if (!object || !Number.isInteger(index) || objects.length === 0) {
      return false
    }

    const currentIndex = objects.indexOf(object)
    const role = object instanceof FabricImage
      ? this.imageRoles.get(object) ?? 'element'
      : 'element'
    const backgroundCount = objects.filter(
      (entry) => entry instanceof FabricImage && this.imageRoles.get(entry) === 'background',
    ).length
    const minimumIndex = role === 'background' ? 0 : backgroundCount
    const maximumIndex = role === 'background' ? 0 : objects.length - 1
    const nextIndex = Math.min(Math.max(index, minimumIndex), maximumIndex)
    if (currentIndex === nextIndex) {
      return false
    }

    this.canvas.moveObjectTo(object, nextIndex)
    this.canvas.requestRenderAll()
    this.commitHistory()
    return true
  }

  /**
   * 将现有图片转换为铺满当前 UV 可打印区域的设计背景
   *
   * 转换会替换已有设计背景、重置旋转、锁定对象并移动到最底层
   *
   * @param id Design JSON 中的图片对象 ID
   * @returns 是否找到普通图片并完成转换
   */
  setImageAsBackground(id: string): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    if (
      !(object instanceof FabricImage) ||
      this.imageRoles.get(object) === 'background'
    ) {
      return false
    }

    if (object.group instanceof ActiveSelection) this.canvas.discardActiveObject()
    this.fitImageToEditableBounds(object)
    this.removeDesignBackgrounds()
    this.imageRoles.set(object, 'background')
    this.applyObjectLock(object, true)
    this.canvas.moveObjectTo(object, 0)
    this.canvas.setActiveObject(object)
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.commitHistory()
    return true
  }

  /**
   * 修改对象在图层面板中的名称
   *
   * @param id Design JSON 中的对象 ID
   * @param name 非空图层名称
   * @returns 是否找到并更新了对象
   */
  renameObject(id: string, name: string): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    const normalizedName = name.trim()
    if (!object || !normalizedName) {
      return false
    }

    this.objectNames.set(object, normalizedName)
    this.canvas.requestRenderAll()
    this.commitHistory(false)
    return true
  }

  /**
   * 修改对象是否参与渲染
   *
   * @param id Design JSON 中的对象 ID
   * @param visible 是否参与二维画布、三维纹理和 PNG 渲染
   * @returns 是否找到并更新了对象
   */
  setObjectVisibility(id: string, visible: boolean): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    if (!object || object.visible === visible) {
      return Boolean(object)
    }

    if (!visible && this.canvas.getActiveObjects().includes(object)) {
      this.canvas.discardActiveObject()
    }
    object.set({ visible })
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.commitHistory()
    return true
  }

  /**
   * 修改对象是否允许通过画布控件变换
   *
   * @param id Design JSON 中的对象 ID
   * @param locked 是否锁定移动、缩放、旋转、倾斜和文字编辑
   * @returns 是否找到并更新了对象
   */
  setObjectLocked(id: string, locked: boolean): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    if (!object) {
      return false
    }

    this.applyObjectLock(object, locked)
    this.canvas.requestRenderAll()
    this.commitHistory(false)
    return true
  }

  /**
   * 更新对象中心位置、缩放、旋转和翻转
   *
   * 默认限制出界；启用 overflow 的背景保留出血变换，连续调用合并为一个历史步骤
   * 单轴缩放保持另一轴，绝对值重复调用不会累积压缩
   *
   * @param id Design JSON 中的对象 ID
   * @param options 要更新的变换字段
   * @returns 约束后的对象快照，找不到对象时返回 undefined
   * @throws 数值无效或缩放倍数不大于零时抛出错误
   */
  updateObjectTransform(
    id: string,
    options: UpdateObjectTransformOptions,
  ): DesignObject | undefined {
    const object = this.objectsById.get(id)
    if (!object) {
      return undefined
    }
    this.validateTransformOptions(options)

    const selectedIds = this.getSelectedObjectIds()
    if (object.group instanceof ActiveSelection) {
      this.canvas.discardActiveObject()
    }

    const previous = captureGeometry(object)
    const current = this.serializeTransform(object)
    const x = options.x ?? current.x
    const y = options.y ?? current.y
    object.set({
      scaleX: options.scaleX ?? current.scaleX,
      scaleY: options.scaleY ?? current.scaleY,
      angle: options.rotation ?? current.rotation,
      flipX: options.flipX ?? current.flipX,
      flipY: options.flipY ?? current.flipY,
    })
    object.setPositionByOrigin(new Point(x, y), 'center', 'center')
    if (!validGeometry(object)) {
      object.set(previous)
      if (selectedIds.length) this.selectObjects(selectedIds)
      throw new RangeError('Object transform must produce finite geometry')
    }
    if (options.scaleX === undefined && options.scaleY === undefined && options.rotation === undefined
      && options.flipX === undefined && options.flipY === undefined) this.constrainMovement(object)
    else constrainCandidate(object, previous, this.width, this.height, this.allowsOverflow)
    object.setCoords()

    const selectedObjects = selectedIds
      .map((selectedId) => this.objectsById.get(selectedId))
      .filter((selected): selected is FabricObject => Boolean(selected?.visible))
    if (selectedObjects.length > 0) {
      this.applySelection(selectedObjects)
    }
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.scheduleHistoryCommit()
    return this.serializeObject(object)
  }

  /**
   * 修改已有文字对象的内容和排版样式
   *
   * 连续调用会在短暂空闲后合并为一个历史步骤
   * 字体必须由消费页面提前加载，否则浏览器会使用回退字体
   *
   * @param id Design JSON 中的对象 ID
   * @param options 要修改的文字属性，未传字段保持不变
   * @returns 是否找到并更新了文字对象
   * @throws 字号、行高、字距、字重或 CSS 颜色不符合约束时抛出错误
   */
  updateText(id: string, options: UpdateTextOptions): boolean {
    const object = this.objectsById.get(id)
    if (!(object instanceof Textbox)) {
      return false
    }

    if (options.text !== undefined) {
      object.set({ text: options.text })
    }
    if (options.fontFamily !== undefined) {
      const fontFamily = options.fontFamily.trim()
      if (!fontFamily) {
        throw new TypeError('fontFamily must be a non-empty string')
      }
      object.set({ fontFamily })
    }
    if (options.fontSize !== undefined) {
      if (!Number.isFinite(options.fontSize) || options.fontSize <= 0) {
        throw new RangeError('fontSize must be greater than zero')
      }
      object.set({ fontSize: options.fontSize })
    }
    if (options.color !== undefined) {
      if (!options.color.trim()) {
        throw new TypeError('color must be a non-empty CSS color')
      }
      object.set({ fill: options.color })
    }
    if (options.fontWeight !== undefined) {
      const validWeight =
        options.fontWeight === 'normal' ||
        options.fontWeight === 'bold' ||
        (typeof options.fontWeight === 'number' &&
          Number.isFinite(options.fontWeight) &&
          options.fontWeight > 0 &&
          options.fontWeight <= 1000)
      if (!validWeight) {
        throw new RangeError(
          'fontWeight must be normal, bold, or between 1 and 1000',
        )
      }
      object.set({ fontWeight: options.fontWeight })
    }
    if (options.fontStyle !== undefined) {
      if (options.fontStyle !== 'normal' && options.fontStyle !== 'italic') {
        throw new TypeError('fontStyle must be normal or italic')
      }
      object.set({ fontStyle: options.fontStyle })
    }
    if (options.underline !== undefined) {
      object.set({ underline: options.underline })
    }
    if (options.textAlign !== undefined) {
      if (!['left', 'center', 'right'].includes(options.textAlign)) {
        throw new TypeError('textAlign must be left, center, or right')
      }
      object.set({ textAlign: options.textAlign })
    }
    if (options.lineHeight !== undefined) {
      if (!Number.isFinite(options.lineHeight) || options.lineHeight <= 0) {
        throw new RangeError('lineHeight must be greater than zero')
      }
      object.set({ lineHeight: options.lineHeight })
    }
    if (options.charSpacing !== undefined) {
      if (!Number.isFinite(options.charSpacing)) {
        throw new TypeError('charSpacing must be a finite number')
      }
      object.set({ charSpacing: options.charSpacing })
    }
    if (options.backgroundColor !== undefined) {
      if (options.backgroundColor !== null && !options.backgroundColor.trim()) {
        throw new TypeError(
          'backgroundColor must be a non-empty CSS color or null',
        )
      }
      object.set({ backgroundColor: options.backgroundColor ?? '' })
    }

    object.initDimensions()
    if (object.group instanceof ActiveSelection) {
      const selected = this.getSelectedObjectIds()
      this.canvas.discardActiveObject()
      this.constrainObjectToCanvas(object)
      this.selectObjects(selected)
    } else {
      this.constrainObjectToCanvas(object)
    }
    this.canvas.requestRenderAll()
    this.scheduleHistoryCommit()
    return true
  }

  /**
   * 让一个未锁定文字对象进入画布内联编辑状态
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到文字对象并进入编辑状态
   */
  editText(id: string): boolean {
    this.flushHistoryCommit()
    const object = this.objectsById.get(id)
    if (
      !(object instanceof Textbox) ||
      !object.visible ||
      (this.objectLocks.get(object) ?? false)
    ) {
      return false
    }

    this.canvas.setActiveObject(object)
    object.enterEditing()
    object.hiddenTextarea?.focus()
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    return true
  }

  /**
   * 设置铺满画布的基础纹理，不传地址时恢复透明背景
   *
   * 背景纹理不参与对象选择，但会包含在实时纹理和 PNG 导出中
   *
   * @param url 基础纹理地址
   * @throws 图片加载失败或被 CORS 策略阻止时抛出错误
   */
  async setBackgroundTexture(url?: string): Promise<void> {
    this.commitBackgroundTexture(await this.prepareBackgroundTexture(url))
  }

  /** 加载并准备基础纹理，不替换当前背景，失败时保留旧设计 */
  async prepareBackgroundTexture(url?: string): Promise<FabricImage | undefined> {
    if (!url) return undefined
    const image = await this.loadImage(url)
    const scaleX = this.width / Math.max(image.width, 1)
    const scaleY = this.height / Math.max(image.height, 1)

    image.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX,
      scaleY,
      selectable: false,
      evented: false,
    })

    return image
  }

  /** 提交已经加载的基础纹理并释放旧背景，不触发异步加载 */
  commitBackgroundTexture(image?: FabricImage): void {
    const previous = this.canvas.backgroundImage
    this.canvas.backgroundImage = image
    this.canvas.backgroundColor = ''
    this.markContentChanged()
    this.canvas.requestRenderAll()
    if (previous !== image) previous?.dispose()
  }

  /**
   * 添加并选中一个可编辑文字对象
   *
   * 文字位置使用画布像素坐标，原点位于对象左上角
   * 对象过大时初次等比适配，越界时会自动移回画布
   *
   * @param options 文字内容、位置和样式
   * @returns 创建后的可持久化文字对象快照
   */
  addText(options: AddTextOptions = {}): TextDesignObject {
    this.flushHistoryCommit()
    const text = new Textbox(options.text ?? this.defaultText, {
      left: options.x ?? this.defaultPlacementBounds().left,
      top: options.y ?? this.defaultPlacementBounds().top,
      width: options.width ?? this.defaultPlacementBounds().width * 0.6,
      fontFamily: options.fontFamily ?? 'Arial',
      fontSize: options.fontSize ?? 22,
      fontWeight: options.fontWeight ?? 700,
      fontStyle: options.fontStyle ?? 'normal',
      underline: options.underline ?? false,
      fill: options.color ?? '#172126',
      backgroundColor: options.backgroundColor ?? '',
      originX: 'left',
      originY: 'top',
      textAlign: options.textAlign ?? 'center',
      lineHeight: options.lineHeight ?? 1.16,
      charSpacing: options.charSpacing ?? 0,
      editable: true,
      ...this.objectControlAppearance(),
    })

    this.placeDefaultObject(text, options)
    this.addAndSelect(text, options.name)
    return this.serializeObject(text) as TextDesignObject
  }

  /**
   * 加载、添加并选中一个图片对象
   *
   * role 为 background 时替换已有设计背景、铺满当前 UV 可打印区域并默认锁定在最底层
   * 图片位置使用画布像素坐标，原点位于图片中心
   * 普通图片过大时初次适配；背景启用 objectBoundary.background: overflow 后允许出血和原样恢复
   * 远程图片必须提供正确的 CORS 响应头才能安全导出 PNG
   *
   * @param options 图片地址、中心位置和显示宽度
   * @returns 创建后的可持久化图片对象快照
   * @throws 图片加载失败或被 CORS 策略阻止时抛出错误
   */
  async addImage(options: AddImageOptions): Promise<ImageDesignObject> {
    this.flushHistoryCommit()
    const source = await resolvePersistentImageSource(options.src)
    const image = await this.loadImage(source)
    const role = options.role ?? 'element'
    const targetWidth = options.width ?? this.defaultPlacementBounds().width * 0.4
    const scale = targetWidth / Math.max(image.width, 1)

    image.set({
      left: options.x ?? this.defaultPlacementBounds().left + this.defaultPlacementBounds().width / 2,
      top: options.y ?? this.defaultPlacementBounds().top + this.defaultPlacementBounds().height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      ...this.objectControlAppearance(),
    })

    if (role === 'background') {
      try {
        this.fitImageToEditableBounds(image)
      } catch (error) {
        image.dispose()
        throw error
      }
      this.removeDesignBackgrounds()
    } else {
      this.placeDefaultObject(image, options)
    }
    this.imageSources.set(image, source)
    this.addAndSelect(image, options.name, role === 'background', role)
    return this.serializeObject(image) as ImageDesignObject
  }

  /**
   * 返回与 Fabric.js 无关的当前设计快照
   *
   * 文档包含设计对象和逻辑画布尺寸；启用新映射时包含已解析的打印映射，不包含基础纹理或模型地址
   *
   * @returns 可以安全传给 JSON.stringify 的 Design JSON 文档
   * @throws 画布包含不支持的对象或非字符串文字填充时抛出错误
   */
  saveDesign(): DesignDocument {
    const canvas = { width: this.width, height: this.height }
    const objects = this.getObjects()
    const mapping = this.restoredPrintMapping ?? this.printMapping
    return this.persistMapping && mapping
      ? { version: 2, canvas, printMapping: { ...mapping, domain: { ...mapping.domain } }, objects }
      : { version: 1, canvas, objects }
  }

  /**
   * 校验并恢复 Design JSON，图片全部加载成功后才替换当前对象
   *
   * 背景纹理和当前产品保持不变，恢复后不选中任何对象
   *
   * @param value JSON.parse 结果或符合 DesignDocument 的对象
   * @throws Schema 无效、画布尺寸不匹配或图片无法加载时抛出错误
   */
  async loadDesign(value: unknown): Promise<void> {
    this.flushHistoryCommit()
    await this.replaceDesign(value)
    this.commitHistory()
    this.fitEditorView()
  }

  private async replaceDesign(value: unknown): Promise<void> {
    const generation = ++this.contentGeneration
    const design = parseDesignDocument(value)
    let restoredMapping: DesignPrintMapping | undefined
    if (design.version === 2) {
      if (!this.printMapping) throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Editor has no resolved print mapping')
      restoredMapping = resolveRestoredPrintMapping(design.printMapping, this.printMapping, this.modelRevision)
    } else if (!this.legacyMapping) {
      throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Schema 1 cannot be loaded into a non-original UV mapping; migrate explicitly')
    }
    if (design.canvas.width !== this.width || design.canvas.height !== this.height) {
      throw new PrintSurfaceError('CANVAS_SIZE_MISMATCH',
        `Design canvas ${design.canvas.width}x${design.canvas.height} does not match editor canvas ${this.width}x${this.height}`,
      )
    }

    const entries: Array<{
      id: string
      object: FabricObject
      source?: string
      name?: string
      locked: boolean
      role: DesignImageRole
    }> = []

    try {
      for (const object of design.objects) {
        entries.push({
          id: object.id,
          object: await this.createObjectFromDesign(object),
          source: object.type === 'image' ? object.src : undefined,
          name: object.name,
          locked: object.locked ?? false,
          role: object.type === 'image' ? object.role ?? 'element' : 'element',
        })
        if (!validGeometry(entries[entries.length - 1]!.object)) throw new RangeError('Saved object must produce finite geometry')
      }
      if (this.destroyed || generation !== this.contentGeneration) {
        throw new DOMException('Design loading was superseded or the product mapping changed', 'AbortError')
      }
    } catch (error) {
      entries.forEach(({ object }) => object.dispose())
      throw error
    }

    const previousObjects = this.canvas.getObjects()
    this.persistMapping = design.version === 2
    this.restoredPrintMapping = restoredMapping
    this.canvas.discardActiveObject()
    this.canvas.remove(...previousObjects)
    previousObjects.forEach((object) => object.dispose())
    this.usedObjectIds.clear()
    this.objectsById.clear()

    for (const entry of entries) {
      this.registerObject(
        entry.object,
        entry.id,
        entry.name,
        entry.locked,
        entry.role,
      )
      if (entry.object instanceof FabricImage && entry.source) {
        this.imageSources.set(entry.object, entry.source)
      }
      this.canvas.add(entry.object)
      this.constrainObjectToCanvas(entry.object)
    }

    this.canvas.requestRenderAll()
    this.notifySelectionChange()
  }

  /**
   * 恢复上一个设计快照
   *
   * @returns 是否成功恢复了一个历史步骤
   */
  async undo(): Promise<boolean> {
    this.flushHistoryCommit()
    const target = this.history.peekUndo()
    if (!target || this.historyBusy) {
      return false
    }

    this.historyBusy = true
    try {
      await this.replaceDesign(target)
      this.history.confirmUndo()
      this.historySignature = JSON.stringify(this.saveDesign())
      this.notifyHistoryChange()
      return true
    } finally {
      this.historyBusy = false
    }
  }

  /**
   * 恢复下一个设计快照
   *
   * @returns 是否成功恢复了一个历史步骤
   */
  async redo(): Promise<boolean> {
    this.flushHistoryCommit()
    const target = this.history.peekRedo()
    if (!target || this.historyBusy) {
      return false
    }

    this.historyBusy = true
    try {
      await this.replaceDesign(target)
      this.history.confirmRedo()
      this.historySignature = JSON.stringify(this.saveDesign())
      this.notifyHistoryChange()
      return true
    } finally {
      this.historyBusy = false
    }
  }

  /** 以当前设计为起点清空撤销与重做历史 */
  clearHistory(): void {
    this.flushHistoryCommit()
    const current = this.saveDesign()
    this.history.reset(current)
    this.historySignature = JSON.stringify(current)
    this.notifyHistoryChange()
  }

  /**
   * 删除当前对象或多选选区
   *
   * @returns 是否删除了至少一个对象
   */
  deleteSelected(): boolean {
    this.flushHistoryCommit()
    const selection = this.canvas.getActiveObjects()
    if (selection.length === 0) {
      return false
    }

    this.canvas.remove(...selection)
    selection.forEach((object) => {
      this.unregisterObject(object)
      object.dispose()
    })
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.commitHistory()
    return true
  }

  /**
   * 将当前画布内容导出为 PNG 并触发浏览器下载
   *
   * @param filename 下载文件名
   * @throws 画布被无 CORS 授权的远程图片污染时抛出安全错误
   */
  exportTexture(filename = 'custom-texture.png'): void {
    const anchor = document.createElement('a')
    anchor.download = filename
    anchor.href = this.getTextureDataUrl()
    anchor.click()
  }

  /**
   * 返回不含选择框和 UV 辅助层的 PNG Data URL
   *
   * @returns 与逻辑画布同尺寸的 PNG Data URL
   * @throws 远程图片污染 Canvas 时抛出安全错误
   */
  getTextureDataUrl(): string {
    this.renderTextureCanvas()
    return this.textureCanvasElement.toDataURL('image/png')
  }

  /**
   * 异步返回不含选择框和 UV 辅助层的 PNG Blob
   *
   * @returns 与逻辑画布同尺寸的 PNG Blob
   * @throws 远程图片污染 Canvas 或浏览器无法编码时抛出错误
   */
  getTextureBlob(): Promise<Blob> {
    this.renderTextureCanvas()
    return new Promise((resolve, reject) => {
      this.textureCanvasElement.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('The texture canvas could not be encoded as PNG'))
        }
      }, 'image/png')
    })
  }

  /** 释放 ResizeObserver、事件监听和 Fabric Canvas */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.constrainTransformEvent = undefined
    this.contentGeneration += 1
    if (this.historyTimer !== undefined) {
      clearTimeout(this.historyTimer)
      this.historyTimer = undefined
    }
    this.resizeObserver.disconnect()
    cancelAnimationFrame(this.resizeFrame)
    window.removeEventListener('resize', this.scheduleDisplayResize)
    this.dprQuery?.removeEventListener('change', this.onDprChange)
    this.editorViewListeners.clear()
    this.textureListeners.clear()
    this.renderListeners.clear()
    this.selectionListeners.clear()
    this.historyListeners.clear()
    this.objectsById.clear()
    this.usedObjectIds.clear()
    this.canvas.dispose()
    this.host.replaceChildren()
  }

  private addAndSelect(
    object: FabricObject,
    name?: string,
    locked = false,
    role: DesignImageRole = 'element',
  ): void {
    this.registerObject(object, undefined, name, locked, role)
    this.canvas.add(object)
    if (object instanceof FabricImage && role === 'background') {
      this.canvas.moveObjectTo(object, 0)
    }
    this.constrainObjectToCanvas(object)
    this.canvas.setActiveObject(object)
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
    this.commitHistory()
  }

  private registerObject(
    object: FabricObject,
    id = this.createObjectId(),
    name?: string,
    locked = false,
    role: DesignImageRole = 'element',
  ): void {
    if (this.usedObjectIds.has(id)) {
      throw new Error(`Design object id is already in use: ${id}`)
    }
    this.usedObjectIds.add(id)
    this.objectIds.set(object, id)
    this.objectsById.set(id, object)
    if (name) {
      this.objectNames.set(object, name)
    }
    if (object instanceof FabricImage) {
      this.imageRoles.set(object, role)
    }
    this.applyObjectLock(object, locked)
  }

  private unregisterObject(object: FabricObject): void {
    const id = this.objectIds.get(object)
    if (id) {
      this.objectsById.delete(id)
    }
  }

  private createObjectId(): string {
    let id: string
    do {
      this.objectIdSequence += 1
      id = `object-${this.objectIdSequence}`
    } while (this.usedObjectIds.has(id))
    return id
  }

  private serializeObject(object: FabricObject): DesignObject {
    const id = this.objectIds.get(object)
    if (!id) {
      throw new Error('Design object is missing its stable id')
    }

    const transform = this.serializeTransform(object)
    const state = {
      name: this.objectNames.get(object) ?? this.createObjectName(object),
      visible: object.visible,
      locked: this.objectLocks.get(object) ?? false,
    }
    if (object instanceof Textbox) {
      if (typeof object.fill !== 'string') {
        throw new Error(`Text object ${id} uses an unsupported non-string fill`)
      }
      return {
        id,
        type: 'text',
        ...state,
        transform,
        text: object.text,
        width: object.width,
        fontFamily: object.fontFamily,
        fontSize: object.fontSize,
        color: object.fill,
        fontWeight: object.fontWeight as TextFontWeight,
        fontStyle: object.fontStyle as TextFontStyle,
        underline: object.underline,
        textAlign: object.textAlign as TextAlignment,
        lineHeight: object.lineHeight,
        charSpacing: object.charSpacing,
        ...(object.backgroundColor
          ? { backgroundColor: object.backgroundColor }
          : {}),
      }
    }

    if (object instanceof FabricImage) {
      const src = this.imageSources.get(object) ?? object.getSrc()
      if (!src || src.startsWith('blob:')) {
        throw new Error(`Image object ${id} does not have a persistent source`)
      }
      return {
        id,
        type: 'image',
        ...state,
        transform,
        src,
        role: this.imageRoles.get(object) ?? 'element',
      }
    }

    throw new Error(`Design object ${id} has an unsupported type`)
  }

  private serializeTransform(object: FabricObject): DesignObjectTransform {
    const center = object.getCenterPoint()
    const geometry = object.group instanceof ActiveSelection
      ? util.qrDecompose(object.calcTransformMatrix()) : undefined
    const skewX = geometry?.skewX ?? object.skewX
    const skewY = geometry?.skewY ?? object.skewY
    return {
      x: center.x,
      y: center.y,
      scaleX: Math.abs(geometry?.scaleX ?? object.scaleX),
      scaleY: Math.abs(geometry?.scaleY ?? object.scaleY),
      rotation: geometry?.angle ?? object.angle,
      flipX: geometry ? geometry.scaleX < 0 : object.scaleX < 0 ? !object.flipX : object.flipX,
      flipY: geometry ? geometry.scaleY < 0 : object.scaleY < 0 ? !object.flipY : object.flipY,
      ...(skewX ? { skewX } : {}),
      ...(skewY ? { skewY } : {}),
    }
  }

  private async createObjectFromDesign(design: DesignObject): Promise<FabricObject> {
    const common = {
      left: design.transform.x,
      top: design.transform.y,
      originX: 'center' as const,
      originY: 'center' as const,
      scaleX: design.transform.scaleX,
      scaleY: design.transform.scaleY,
      angle: design.transform.rotation,
      flipX: design.transform.flipX,
      flipY: design.transform.flipY,
      skewX: design.transform.skewX ?? 0,
      skewY: design.transform.skewY ?? 0,
      visible: design.visible ?? true,
      ...this.objectControlAppearance(),
    }

    if (design.type === 'text') {
      return new Textbox(design.text, {
        ...common,
        width: design.width,
        fontFamily: design.fontFamily,
        fontSize: design.fontSize,
        fontWeight: design.fontWeight ?? 700,
        fontStyle: design.fontStyle ?? 'normal',
        underline: design.underline ?? false,
        fill: design.color,
        backgroundColor: design.backgroundColor ?? '',
        textAlign: design.textAlign ?? 'center',
        lineHeight: design.lineHeight ?? 1.16,
        charSpacing: design.charSpacing ?? 0,
        editable: true,
      })
    }

    const image = await this.loadImage(design.src)
    image.set(common)
    return image
  }

  private async loadImage(source: string): Promise<FabricImage> {
    const image = await FabricImage.fromURL(
      source,
      source.startsWith('data:') ? undefined : { crossOrigin: 'anonymous' },
    )
    if (this.destroyed) {
      image.dispose()
      throw new DOMException('Editor was destroyed during image loading', 'AbortError')
    }
    return image
  }

  private createObjectName(object: FabricObject): string {
    if (object instanceof Textbox) {
      return object.text.trim().slice(0, 48) || this.textObjectName
    }
    if (object instanceof FabricImage) {
      return this.imageRoles.get(object) === 'background'
        ? this.backgroundObjectName
        : this.imageObjectName
    }
    return 'Object'
  }

  private applyObjectLock(object: FabricObject, locked: boolean): void {
    this.objectLocks.set(object, locked)
    object.set({
      hasBorders: !locked,
      hasControls: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockRotation: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockSkewingX: locked,
      lockSkewingY: locked,
    })
    if (object instanceof Textbox) {
      object.set({ editable: !locked })
    }
  }

  private notifySelectionChange(): void {
    const objectIds = this.getSelectedObjectIds()
    this.selectionListeners.forEach((listener) => listener(objectIds))
  }

  private removeDesignBackgrounds(): void {
    const backgrounds = this.canvas.getObjects().filter(
      (object): object is FabricImage =>
        object instanceof FabricImage && this.imageRoles.get(object) === 'background',
    )
    if (backgrounds.length === 0) {
      return
    }

    if (backgrounds.some((object) => this.canvas.getActiveObjects().includes(object))) {
      this.canvas.discardActiveObject()
    }
    this.canvas.remove(...backgrounds)
    backgrounds.forEach((object) => {
      this.unregisterObject(object)
      object.dispose()
    })
  }

  private scheduleHistoryCommit(): void {
    this.markContentChanged()
    if (this.historyBusy) {
      return
    }
    if (this.historyTimer !== undefined) {
      clearTimeout(this.historyTimer)
    }
    this.historyTimer = setTimeout(() => {
      this.historyTimer = undefined
      this.commitHistory()
    }, 320)
  }

  private flushHistoryCommit(): void {
    if (this.historyTimer === undefined) {
      return
    }
    clearTimeout(this.historyTimer)
    this.historyTimer = undefined
    this.commitHistory()
  }

  private commitHistory(textureChanged = true): void {
    if (this.historyBusy) {
      return
    }
    if (this.historyTimer !== undefined) {
      clearTimeout(this.historyTimer)
      this.historyTimer = undefined
    }

    const snapshot = this.saveDesign()
    const signature = JSON.stringify(snapshot)
    if (signature === this.historySignature) {
      return
    }
    this.history.push(snapshot)
    this.historySignature = signature
    this.markContentChanged(textureChanged)
    this.notifyHistoryChange()
  }

  private notifyHistoryChange(): void {
    const state = this.history.state
    this.historyListeners.forEach((listener) => listener(state))
  }

  private constrainObjectToCanvas(object: FabricObject): void {
    if (this.allowsOverflow(object)) { object.setCoords(); return }
    object.setCoords()
    let bounds = liveBounds(object)
    const epsilon = 1e-7
    if (bounds.left >= -epsilon && bounds.top >= -epsilon && bounds.left + bounds.width <= this.width + epsilon && bounds.top + bounds.height <= this.height + epsilon) return
    const scale = calculateContainmentScale(bounds, this.width, this.height)

    if (scale < 1) {
      object.set({
        scaleX: object.scaleX * scale,
        scaleY: object.scaleY * scale,
      })
      object.setCoords()
      bounds = liveBounds(object)
    }

    const offset = calculateContainmentOffset(bounds, this.width, this.height)
    if (offset.x !== 0 || offset.y !== 0) {
      object.set({
        left: object.left + offset.x,
        top: object.top + offset.y,
      })
      object.setCoords()
    }
  }

  private readonly allowsOverflow = (object: FabricObject): boolean => this.objectBoundary.background === 'overflow'
    && object instanceof FabricImage && this.imageRoles.get(object) === 'background'

  private constrainMovement(object: FabricObject): void {
    const bounds = boundedObjects(object, this.allowsOverflow).map(liveBounds)
    if (!bounds.length) return
    const left = Math.min(...bounds.map((entry) => entry.left)), top = Math.min(...bounds.map((entry) => entry.top))
    const right = Math.max(...bounds.map((entry) => entry.left + entry.width)), bottom = Math.max(...bounds.map((entry) => entry.top + entry.height))
    const offset = calculateContainmentOffset({ left, top, width: right - left, height: bottom - top }, this.width, this.height)
    object.set({ left: object.left + offset.x, top: object.top + offset.y })
    object.setCoords()
  }

  private resizeDisplay(forceOverlay = false): void {
    if (this.destroyed) return
    const style = getComputedStyle(this.host)
    const viewport = {
      width: Math.max(0, this.host.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')),
      height: Math.max(0, this.host.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')),
    }
    const state = calculateEditorView({ width: this.width, height: this.height }, this.actualPrintableBounds, viewport, this.editorViewOptions, this.editorViewState)
    const changed = JSON.stringify(state) !== JSON.stringify(this.editorViewState)
    const dpr = this.canvas.getRetinaScaling()
    const dprChanged = dpr !== this.displayDpr
    this.editorViewState = state
    if (viewport.width > 2 * state.minPadding && viewport.height > 2 * state.minPadding) {
      if (this.canvas.width !== viewport.width || this.canvas.height !== viewport.height || dprChanged) {
        this.canvas.setDimensions(viewport)
        this.uvOverlay.width = Math.ceil(viewport.width * dpr)
        this.uvOverlay.height = Math.ceil(viewport.height * dpr)
        this.displayDpr = dpr
      }
      if (changed || dprChanged || forceOverlay) {
        this.canvas.setViewportTransform([state.zoom, 0, 0, state.zoom, state.offsetX, state.offsetY])
        this.canvas.getObjects().forEach((object) => object.setCoords())
        this.canvas.getActiveObject()?.setCoords()
        this.drawEditorGuides(state, dpr)
      }
    }
    if (changed || dprChanged) this.editorViewListeners.forEach((listener) => listener(this.getEditorViewState()))
  }

  private drawEditorGuides(state: EditorViewState, dpr: number): void {
    const bounds = state.fit === 'canvas' || state.fallback !== 'none'
      ? { left: 0, top: 0, width: this.width, height: this.height } : state.printableBounds
    const { zoom: z, paddingRatio: r } = state
    Object.assign(this.paper.style, {
      left: `${state.offsetX + z * (bounds.left - bounds.width * r)}px`,
      top: `${state.offsetY + z * (bounds.top - bounds.height * r)}px`,
      width: `${z * bounds.width * (1 + 2 * r)}px`,
      height: `${z * bounds.height * (1 + 2 * r)}px`,
    })
    const context = this.uvOverlay.getContext('2d')
    if (context && this.uvPaths) renderUvOverlay(context, this.uvPaths, state, dpr, {
      fill: this.appearance.uvFill ?? (getComputedStyle(this.canvas.wrapperEl).getPropertyValue('--cfw-accent').trim() || '#268a4b'),
      boundary: this.appearance.uvBoundary,
    })
  }

  private readonly onDprChange = () => {
    this.observeDpr()
    this.scheduleDisplayResize()
  }

  private observeDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange)
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
    this.dprQuery.addEventListener('change', this.onDprChange)
  }

  private defaultPlacementBounds(): CanvasBounds {
    return hasEditorViewBounds(this.actualPrintableBounds) ? this.actualPrintableBounds : { left: 0, top: 0, width: this.width, height: this.height }
  }

  private placeDefaultObject(object: FabricObject, options: { x?: number; y?: number }): void {
    if (options.x !== undefined || options.y !== undefined) return
    const bounds = this.defaultPlacementBounds()
    const box = object.getBoundingRect()
    const scale = Math.min(1, bounds.width * 0.8 / Math.max(box.width, 1), bounds.height * 0.65 / Math.max(box.height, 1))
    object.set({ scaleX: object.scaleX * scale, scaleY: object.scaleY * scale })
    object.setPositionByOrigin(new Point(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2), 'center', 'center')
    object.setCoords()
  }

  private markContentChanged(textureChanged = true): void {
    this.contentDirty = true
    if (textureChanged) {
      this.textureDirty = true
      this.textureNotificationPending = true
    }
  }

  private applySelection(objects: FabricObject[]): void {
    this.canvas.discardActiveObject()
    this.canvas.setActiveObject(
      objects.length === 1
        ? objects[0]
        : new ActiveSelection(objects, { canvas: this.canvas }),
    )
  }

  private objectControlAppearance(): Record<string, string | number | boolean> {
    return {
      transparentCorners: false,
      cornerColor: this.appearance.controlFill,
      cornerStrokeColor: this.appearance.controlBorder,
      borderColor: this.appearance.objectBorder,
      cornerSize: this.appearance.controlSize,
      objectCaching: false,
    }
  }

  private validateTransformOptions(options: UpdateObjectTransformOptions): void {
    for (const [name, value] of [
      ['x', options.x],
      ['y', options.y],
      ['rotation', options.rotation],
    ] as const) {
      if (value !== undefined && !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number`)
      }
    }
    for (const [name, value] of [
      ['scaleX', options.scaleX],
      ['scaleY', options.scaleY],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new RangeError(`${name} must be greater than zero`)
      }
    }
    for (const [name, value] of [
      ['flipX', options.flipX],
      ['flipY', options.flipY],
    ] as const) {
      if (value !== undefined && typeof value !== 'boolean') {
        throw new TypeError(`${name} must be a boolean`)
      }
    }
  }

  private fitImageToEditableBounds(image: FabricImage): void {
    const bounds = this.editableBounds
    if (bounds.width <= 0 || bounds.height <= 0) throw new PrintSurfaceError('UV_OUTSIDE_DESIGN_DOMAIN', 'Print surface has no editable extent inside the configured domain')
    image.set({
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      angle: 0,
      skewX: 0,
      skewY: 0,
      scaleX: bounds.width / Math.max(image.width, 1),
      scaleY: bounds.height / Math.max(image.height, 1),
    })
    image.setCoords()
  }

  private renderTextureCanvas(): void {
    if (!this.textureDirty) return
    this.renderingTexture = true
    try {
      this.textureRenderer.renderTexture(this.textureContext, this.width, this.height)
      this.textureDirty = false
    } finally {
      this.renderingTexture = false
    }
  }
}
