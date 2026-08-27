import {
  Canvas,
  FabricImage,
  Textbox,
  type FabricObject,
} from 'fabric'
import { parseDesignDocument } from '../core/design'
import type {
  AddImageOptions,
  AddTextOptions,
  DesignDocument,
  DesignObject,
  DesignObjectTransform,
} from '../core/types'
import {
  calculateContainmentOffset,
  calculateContainmentScale,
} from './objectBounds'
import { resolvePersistentImageSource } from './imageSource'

/** 二维编辑器内部初始化配置 */
interface DesignEditorOptions {
  /** 画布逻辑宽度，单位为像素 */
  width: number

  /** 画布逻辑高度，单位为像素 */
  height: number
}

type RenderListener = () => void
type SelectionListener = (objectIds: string[]) => void

/**
 * 基于 Fabric.js 的二维纹理编辑器
 *
 * 负责基础纹理、文字、图片、对象选择和 PNG 导出
 * 显示尺寸可以响应容器变化，内部逻辑尺寸保持不变
 */
export class DesignEditor {
  /** 当前实例使用的 Fabric Canvas */
  readonly canvas: Canvas

  private readonly host: HTMLElement
  private readonly width: number
  private readonly height: number
  private readonly renderListeners = new Set<RenderListener>()
  private readonly selectionListeners = new Set<SelectionListener>()
  private readonly objectIds = new WeakMap<FabricObject, string>()
  private readonly objectsById = new Map<string, FabricObject>()
  private readonly objectNames = new WeakMap<FabricObject, string>()
  private readonly objectLocks = new WeakMap<FabricObject, boolean>()
  private readonly usedObjectIds = new Set<string>()
  private readonly imageSources = new WeakMap<FabricImage, string>()
  private readonly resizeObserver: ResizeObserver
  private objectIdSequence = 0

  /**
   * @param host 二维编辑器挂载容器
   * @param options 画布逻辑尺寸
   */
  constructor(host: HTMLElement, options: DesignEditorOptions) {
    this.host = host
    this.width = options.width
    this.height = options.height

    const element = document.createElement('canvas')
    element.setAttribute('aria-label', 'UV texture editor')
    host.replaceChildren(element)

    this.canvas = new Canvas(element, {
      width: this.width,
      height: this.height,
      backgroundColor: '#f7f7f5',
      preserveObjectStacking: true,
      selectionColor: 'rgba(19, 113, 125, 0.12)',
      selectionBorderColor: '#13717d',
    })

    this.canvas.wrapperEl.classList.add('customforge-design-canvas')
    this.host.dataset.renderState = 'pending'
    this.canvas.on('after:render', () => {
      this.markRenderState()
      this.renderListeners.forEach((listener) => listener())
    })

    const notifySelection = () => this.notifySelectionChange()

    this.canvas.on('selection:created', notifySelection)
    this.canvas.on('selection:updated', notifySelection)
    this.canvas.on('selection:cleared', notifySelection)

    const constrainTarget = ({ target }: { target: FabricObject }) => {
      this.constrainObjectToCanvas(target)
    }
    this.canvas.on('object:moving', constrainTarget)
    this.canvas.on('object:scaling', constrainTarget)
    this.canvas.on('object:rotating', constrainTarget)
    this.canvas.on('object:skewing', constrainTarget)
    this.canvas.on('object:resizing', constrainTarget)
    this.canvas.on('object:modified', constrainTarget)
    this.canvas.on('text:changed', constrainTarget)

    this.resizeObserver = new ResizeObserver(() => this.resizeDisplay())
    this.resizeObserver.observe(host)
    this.resizeDisplay()
  }

  /** 供 Three.js 创建 CanvasTexture 的底层 HTML Canvas */
  get textureCanvas(): HTMLCanvasElement {
    return this.canvas.getElement()
  }

  /** 当前画布中可编辑对象的数量，不包含背景纹理 */
  get objectCount(): number {
    return this.canvas.getObjects().length
  }

  /**
   * 订阅 Fabric Canvas 完成渲染事件
   *
   * @param listener 每次画布完成渲染后调用的函数
   * @returns 用于取消本次订阅的函数
   */
  onRender(listener: RenderListener): () => void {
    this.renderListeners.add(listener)
    return () => this.renderListeners.delete(listener)
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
   * 返回当前对象的独立 Design JSON 快照
   *
   * @returns 按画布层级从后到前排列的对象数组
   */
  getObjects(): DesignObject[] {
    return this.canvas.getObjects().map((object) => this.serializeObject(object))
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
    const object = this.objectsById.get(id)
    if (!object || !object.visible) {
      return false
    }

    this.canvas.setActiveObject(object)
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
    const object = this.objectsById.get(id)
    const objects = this.canvas.getObjects()
    if (!object || !Number.isInteger(index) || objects.length === 0) {
      return false
    }

    const currentIndex = objects.indexOf(object)
    const nextIndex = Math.min(Math.max(index, 0), objects.length - 1)
    if (currentIndex === nextIndex) {
      return false
    }

    this.canvas.moveObjectTo(object, nextIndex)
    this.canvas.requestRenderAll()
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
    const object = this.objectsById.get(id)
    const normalizedName = name.trim()
    if (!object || !normalizedName) {
      return false
    }

    this.objectNames.set(object, normalizedName)
    this.canvas.requestRenderAll()
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
    const object = this.objectsById.get(id)
    if (!object) {
      return false
    }

    this.applyObjectLock(object, locked)
    this.canvas.requestRenderAll()
    return true
  }

  /**
   * 设置铺满画布的基础纹理，不传地址时恢复默认背景色
   *
   * 背景纹理不参与对象选择，但会包含在实时纹理和 PNG 导出中
   *
   * @param url 基础纹理地址
   * @throws 图片加载失败或被 CORS 策略阻止时抛出错误
   */
  async setBackgroundTexture(url?: string): Promise<void> {
    if (!url) {
      this.canvas.backgroundImage = undefined
      this.canvas.backgroundColor = '#f7f7f5'
      this.canvas.requestRenderAll()
      return
    }

    const image = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
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

    this.canvas.backgroundImage = image
    this.canvas.requestRenderAll()
  }

  /**
   * 添加并选中一个可编辑文字对象
   *
   * 文字位置使用画布像素坐标，原点位于对象左上角
   * 对象过大时会等比缩小，越界时会自动移回画布
   *
   * @param options 文字内容、位置和样式
   * @returns 创建的 Fabric Textbox
   */
  addText(options: AddTextOptions = {}): Textbox {
    const text = new Textbox(options.text ?? 'Edit this text', {
      left: options.x ?? this.width * 0.18,
      top: options.y ?? this.height * 0.36,
      width: options.width ?? this.width * 0.42,
      fontFamily: options.fontFamily ?? 'Arial',
      fontSize: options.fontSize ?? Math.round(this.height * 0.12),
      fontWeight: 700,
      fill: options.color ?? '#172126',
      originX: 'left',
      originY: 'top',
      textAlign: 'center',
      editable: true,
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#13717d',
      borderColor: '#13717d',
      cornerSize: 16,
    })

    this.addAndSelect(text)
    return text
  }

  /**
   * 加载、添加并选中一个图片对象
   *
   * 图片位置使用画布像素坐标，原点位于图片中心
   * 对象过大时会等比缩小，越界时会自动移回画布
   * 远程图片必须提供正确的 CORS 响应头才能安全导出 PNG
   *
   * @param options 图片地址、中心位置和显示宽度
   * @returns 创建的 FabricImage
   * @throws 图片加载失败或被 CORS 策略阻止时抛出错误
   */
  async addImage(options: AddImageOptions): Promise<FabricImage> {
    const source = await resolvePersistentImageSource(options.src)
    const image = await this.loadImage(source)
    const targetWidth = options.width ?? this.width * 0.22
    const scale = targetWidth / Math.max(image.width, 1)

    image.set({
      left: options.x ?? this.width * 0.62,
      top: options.y ?? this.height * 0.29,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#13717d',
      borderColor: '#13717d',
      cornerSize: 16,
    })

    this.imageSources.set(image, source)
    this.addAndSelect(image)
    return image
  }

  /**
   * 返回与 Fabric.js 无关的当前设计快照
   *
   * 文档只包含可编辑对象和逻辑画布尺寸，不包含背景纹理或产品模型配置
   *
   * @returns 可以安全传给 JSON.stringify 的 Design JSON 文档
   * @throws 画布包含不支持的对象或非字符串文字填充时抛出错误
   */
  saveDesign(): DesignDocument {
    return {
      version: 1,
      canvas: { width: this.width, height: this.height },
      objects: this.getObjects(),
    }
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
    const design = parseDesignDocument(value)
    if (design.canvas.width !== this.width || design.canvas.height !== this.height) {
      throw new RangeError(
        `Design canvas ${design.canvas.width}x${design.canvas.height} does not match editor canvas ${this.width}x${this.height}`,
      )
    }

    const entries: Array<{
      id: string
      object: FabricObject
      source?: string
      name?: string
      locked: boolean
    }> = []

    try {
      for (const object of design.objects) {
        entries.push({
          id: object.id,
          object: await this.createObjectFromDesign(object),
          source: object.type === 'image' ? object.src : undefined,
          name: object.name,
          locked: object.locked ?? false,
        })
      }
    } catch (error) {
      entries.forEach(({ object }) => object.dispose())
      throw error
    }

    const previousObjects = this.canvas.getObjects()
    this.canvas.discardActiveObject()
    this.canvas.remove(...previousObjects)
    previousObjects.forEach((object) => object.dispose())
    this.usedObjectIds.clear()
    this.objectsById.clear()

    for (const entry of entries) {
      this.registerObject(entry.object, entry.id, entry.name, entry.locked)
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
   * 删除当前对象或多选选区
   *
   * @returns 是否删除了至少一个对象
   */
  deleteSelected(): boolean {
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
    return true
  }

  /**
   * 将当前画布内容导出为 PNG 并触发浏览器下载
   *
   * @param filename 下载文件名
   * @throws 画布被无 CORS 授权的远程图片污染时抛出安全错误
   */
  exportTexture(filename = 'custom-texture.png'): void {
    this.canvas.discardActiveObject()
    this.canvas.renderAll()

    const anchor = document.createElement('a')
    anchor.download = filename
    anchor.href = this.canvas.toDataURL({
      format: 'png',
      multiplier: 1,
    })
    anchor.click()
  }

  /** 释放 ResizeObserver、事件监听和 Fabric Canvas */
  destroy(): void {
    this.resizeObserver.disconnect()
    this.renderListeners.clear()
    this.selectionListeners.clear()
    this.objectsById.clear()
    this.usedObjectIds.clear()
    this.canvas.dispose()
    this.host.replaceChildren()
  }

  private addAndSelect(object: FabricObject): void {
    this.registerObject(object)
    this.canvas.add(object)
    this.constrainObjectToCanvas(object)
    this.canvas.setActiveObject(object)
    this.canvas.requestRenderAll()
    this.notifySelectionChange()
  }

  private registerObject(
    object: FabricObject,
    id = this.createObjectId(),
    name?: string,
    locked = false,
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
      }
    }

    if (object instanceof FabricImage) {
      const src = this.imageSources.get(object) ?? object.getSrc()
      if (!src || src.startsWith('blob:')) {
        throw new Error(`Image object ${id} does not have a persistent source`)
      }
      return { id, type: 'image', ...state, transform, src }
    }

    throw new Error(`Design object ${id} has an unsupported type`)
  }

  private serializeTransform(object: FabricObject): DesignObjectTransform {
    const center = object.getCenterPoint()
    return {
      x: center.x,
      y: center.y,
      scaleX: Math.abs(object.scaleX),
      scaleY: Math.abs(object.scaleY),
      rotation: object.angle,
      flipX: object.scaleX < 0 ? !object.flipX : object.flipX,
      flipY: object.scaleY < 0 ? !object.flipY : object.flipY,
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
      visible: design.visible ?? true,
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#13717d',
      borderColor: '#13717d',
      cornerSize: 16,
    }

    if (design.type === 'text') {
      return new Textbox(design.text, {
        ...common,
        width: design.width,
        fontFamily: design.fontFamily,
        fontSize: design.fontSize,
        fontWeight: 700,
        fill: design.color,
        textAlign: 'center',
        editable: true,
      })
    }

    const image = await this.loadImage(design.src)
    image.set(common)
    return image
  }

  private loadImage(source: string): Promise<FabricImage> {
    return FabricImage.fromURL(
      source,
      source.startsWith('data:') ? undefined : { crossOrigin: 'anonymous' },
    )
  }

  private createObjectName(object: FabricObject): string {
    if (object instanceof Textbox) {
      return object.text.trim().slice(0, 48) || 'Text'
    }
    return object instanceof FabricImage ? 'Image' : 'Object'
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

  private constrainObjectToCanvas(object: FabricObject): void {
    object.setCoords()
    let bounds = object.getBoundingRect()
    const scale = calculateContainmentScale(bounds, this.width, this.height)

    if (scale < 1) {
      object.set({
        scaleX: object.scaleX * scale,
        scaleY: object.scaleY * scale,
      })
      object.setCoords()
      bounds = object.getBoundingRect()
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

  private resizeDisplay(): void {
    const availableWidth = Math.max(this.host.clientWidth - 32, 1)
    const availableHeight = Math.max(this.host.clientHeight - 32, 1)
    const scale = Math.min(
      availableWidth / this.width,
      availableHeight / this.height,
      1,
    )

    this.canvas.setDimensions(
      {
        width: `${Math.floor(this.width * scale)}px`,
        height: `${Math.floor(this.height * scale)}px`,
      },
      { cssOnly: true },
    )
  }

  private markRenderState(): void {
    if (this.host.dataset.renderState === 'nonblank') {
      return
    }

    const context = this.canvas.getContext()
    let minimum = 255
    let maximum = 0
    let opaqueSamples = 0

    for (let row = 1; row < 8; row += 1) {
      for (let column = 1; column < 16; column += 1) {
        const x = Math.floor((column / 16) * this.width)
        const y = Math.floor((row / 8) * this.height)
        const pixel = context.getImageData(x, y, 1, 1).data
        const luminance = (pixel[0] + pixel[1] + pixel[2]) / 3
        minimum = Math.min(minimum, luminance)
        maximum = Math.max(maximum, luminance)
        if (pixel[3] > 0) {
          opaqueSamples += 1
        }
      }
    }

    if (opaqueSamples > 0 && maximum - minimum > 8) {
      this.host.dataset.renderState = 'nonblank'
    }
  }
}
