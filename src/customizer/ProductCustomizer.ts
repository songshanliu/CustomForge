import { normalizeProductConfiguration } from '../core/config'
import {
  parseDesignDocument,
  parseProductDesignDocument,
} from '../core/design'
import { resolveElement } from '../core/dom'
import type {
  AddImageOptions,
  AddTextOptions,
  CustomizerEventMap,
  CustomizerEventName,
  CustomizerOptions,
  DesignArea,
  DesignAreaViewport,
  DesignDocument,
  ProductDesignDocument,
  ProductConfiguration,
} from '../core/types'
import { DesignEditor } from '../editor/DesignEditor'
import type { DesignHistorySnapshot } from '../editor/DesignHistory'
import { AreaTextureBridge } from '../bridge/AreaTextureBridge'
import {
  ProductViewer,
  type ProductViewerDesignArea,
} from '../viewer/ProductViewer'

type EventListener<K extends CustomizerEventName> = (
  detail: CustomizerEventMap[K],
) => void

interface DesignAreaSession {
  design: DesignDocument
  history?: DesignHistorySnapshot<DesignDocument>
  viewport: DesignAreaViewport
}

const DESIGN_AREA_PROCESSOR_VERSION = '1'

/**
 * 统一管理二维编辑器、三维查看器和实时纹理同步
 *
 * 仅支持具有 DOM、Canvas、WebGL 和 ResizeObserver 的浏览器环境
 * 每个实例独立持有 DOM 事件、Fabric 状态和 WebGL 资源
 * 不再使用实例时必须调用 `destroy()`
 */
export class ProductCustomizer {
  private readonly events = new EventTarget()
  private readonly textureBridge: AreaTextureBridge
  private readonly editor: DesignEditor
  private readonly viewer: ProductViewer
  private product: ReturnType<typeof normalizeProductConfiguration>
  private designAreas: ProductViewerDesignArea[] = []
  private readonly areaSessions = new Map<string, DesignAreaSession>()
  private activeAreaId?: string
  private modelFingerprint = ''
  private readonly stopSelectionListener: () => void
  private readonly stopRenderListener: () => void
  private readonly stopHistoryListener: () => void
  private destroyed = false

  private constructor(options: CustomizerOptions) {
    const editorHost = resolveElement(options.editor, 'Editor')
    const viewerHost = resolveElement(options.viewer, 'Viewer')

    if (editorHost === viewerHost) {
      throw new Error('Editor and viewer must use different elements')
    }

    const historyLimit = options.historyLimit ?? 50
    if (!Number.isInteger(historyLimit) || historyLimit < 1) {
      throw new RangeError('historyLimit must be a positive integer')
    }

    const editorWidth = options.editorWidth ?? 1024
    const editorHeight = options.editorHeight ?? 512
    this.product = normalizeProductConfiguration(options.product)
    this.editor = new DesignEditor(editorHost, {
      width: editorWidth,
      height: editorHeight,
      historyLimit,
    })
    this.viewer = new ProductViewer(viewerHost, editorWidth, editorHeight)
    this.textureBridge = new AreaTextureBridge(this.editor, this.viewer)

    this.stopSelectionListener = this.editor.onSelectionChange((objectIds) => {
      this.emit('selectionchange', {
        hasSelection: objectIds.length > 0,
        objectIds,
      })
    })
    this.stopRenderListener = this.editor.onRender(() => {
      const session = this.activeAreaId
        ? this.areaSessions.get(this.activeAreaId)
        : undefined
      if (session) {
        session.design = this.editor.saveDesign()
      }
      this.emit('change', { objectCount: this.editor.objectCount })
    })
    this.stopHistoryListener = this.editor.onHistoryChange((state) => {
      this.emit('historychange', state)
    })
  }

  /**
   * 创建实例并完成初始产品加载
   *
   * @param options 产品定制器初始化配置
   * @returns 初始化完成的产品定制器实例
   * @throws DOM 容器无效或初始化失败时释放已创建资源并继续抛出原始错误
   */
  static async create(options: CustomizerOptions): Promise<ProductCustomizer> {
    const customizer = new ProductCustomizer(options)
    try {
      await customizer.initialize()
      return customizer
    } catch (error) {
      customizer.destroy()
      throw error
    }
  }

  /**
   * 订阅产品定制器事件
   *
   * @param event 事件名称
   * @param listener 接收对应事件载荷的监听函数
   * @returns 用于取消本次订阅的函数
   */
  on<K extends CustomizerEventName>(
    event: K,
    listener: EventListener<K>,
  ): () => void {
    const wrapped = (browserEvent: Event) => {
      listener((browserEvent as CustomEvent<CustomizerEventMap[K]>).detail)
    }
    this.events.addEventListener(event, wrapped)
    return () => this.events.removeEventListener(event, wrapped)
  }

  /**
   * 在二维画布中添加并选中一个文字对象
   *
   * 创建后和用户变换期间，对象会自动缩放或平移以保持完整可见
   *
   * @param options 文字内容、位置和样式配置
   */
  addText(options?: AddTextOptions): void {
    this.editor.addText(options)
  }

  /**
   * 加载图片并将其添加到二维画布
   *
   * role 为 background 时会替换已有设计背景并默认锁定在最底层
   * 创建后和用户变换期间，对象会自动缩放或平移以保持完整可见
   *
   * @param options 图片地址、位置和显示宽度
   * @throws 图片无法访问、加载失败或被 CORS 策略阻止时抛出错误
   */
  async addImage(options: AddImageOptions): Promise<void> {
    try {
      await this.editor.addImage(options)
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /**
   * 返回当前可编辑对象的独立快照
   *
   * @returns 按画布层级从后到前排列的 Design JSON 对象
   */
  getObjects(): DesignDocument['objects'] {
    return this.editor.getObjects()
  }

  /** 当前选中对象的 ID，按画布层级从后到前排列 */
  getSelectedObjectIds(): string[] {
    return this.editor.getSelectedObjectIds()
  }

  /**
   * 按稳定 ID 选中一个可见对象
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到并选中了对象
   */
  selectObject(id: string): boolean {
    return this.editor.selectObject(id)
  }

  /**
   * 按稳定 ID 删除一个对象
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到并删除了对象
   */
  removeObject(id: string): boolean {
    return this.editor.removeObject(id)
  }

  /**
   * 将对象移动到指定图层索引
   *
   * @param id Design JSON 中的对象 ID
   * @param index 从 0 开始的索引，0 表示最底层
   * @returns 对象层级是否发生变化
   */
  moveObject(id: string, index: number): boolean {
    return this.editor.moveObject(id, index)
  }

  /**
   * 修改对象在图层面板中的名称
   *
   * @param id Design JSON 中的对象 ID
   * @param name 非空图层名称
   * @returns 是否找到并更新了对象
   */
  renameObject(id: string, name: string): boolean {
    return this.editor.renameObject(id, name)
  }

  /**
   * 修改对象是否参与渲染
   *
   * @param id Design JSON 中的对象 ID
   * @param visible 是否参与二维画布、三维纹理和 PNG 渲染
   * @returns 是否找到并更新了对象
   */
  setObjectVisibility(id: string, visible: boolean): boolean {
    return this.editor.setObjectVisibility(id, visible)
  }

  /**
   * 修改对象是否允许通过画布控件变换
   *
   * @param id Design JSON 中的对象 ID
   * @param locked 是否锁定移动、缩放、旋转、倾斜和文字编辑
   * @returns 是否找到并更新了对象
   */
  setObjectLocked(id: string, locked: boolean): boolean {
    return this.editor.setObjectLocked(id, locked)
  }

  /** 当前是否显示产品模板、UV、安全区和出血区辅助层 */
  isDesignGuideVisible(): boolean {
    return this.editor.isDesignGuideVisible()
  }

  /**
   * 显示或隐藏产品设计辅助层
   *
   * 该状态不会写入 Design JSON，也不会改变实时纹理或 PNG 导出结果
   *
   * @param visible 是否显示辅助层
   */
  setDesignGuideVisible(visible: boolean): void {
    this.editor.setDesignGuideVisible(visible)
    this.emit('designguidechange', { visible })
  }

  /**
   * 删除二维编辑器中的当前对象或选区
   *
   * @returns 是否删除了至少一个对象
   */
  deleteSelected(): boolean {
    return this.editor.deleteSelected()
  }

  /**
   * 创建当前产品全部设计区域的版本化 JSON 快照
   *
   * 快照包含模型和区域指纹但不包含模型字节、材质或基础纹理配置
   * Blob URL 图片会在添加时转换为 Data URL，因此返回值可以跨页面会话保存
   *
   * @returns 可以安全传给 JSON.stringify 的多区域产品设计文档
   * @throws 设计中存在不支持的对象或文字填充时抛出错误
   */
  saveDesign(): ProductDesignDocument {
    if (!this.activeAreaId) {
      throw new Error('Product does not have an active design area')
    }
    const activeSession = this.areaSessions.get(this.activeAreaId)
    if (activeSession) {
      activeSession.design = this.editor.saveDesign()
      activeSession.viewport = this.editor.getEditorViewport()
    }
    return {
      version: 2,
      modelFingerprint: this.modelFingerprint,
      processorVersion: DESIGN_AREA_PROCESSOR_VERSION,
      activeAreaId: this.activeAreaId,
      areas: this.designAreas.map((record) => {
        const { area } = record
        const session = this.areaSessions.get(area.id)
        if (!session) {
          throw new Error('Design area session was not found: ' + area.id)
        }
        return {
          areaId: area.id,
          areaFingerprint: record.areaFingerprint,
          canvas: { ...session.design.canvas },
          objects: structuredClone(session.design.objects),
        }
      }),
    }
  }

  /**
   * 校验并恢复版本化 Design JSON
   *
   * version 1 单画布文档加载到当前区域，version 2 恢复全部区域
   * version 2 的模型或区域指纹不匹配时拒绝加载，避免映射到错误表面
   * 输入画布尺寸必须与当前编辑器的逻辑尺寸完全一致
   *
   * @param value JSON.parse 结果、version 1 单画布或 version 2 多区域文档
   * @throws Schema 无效、画布尺寸不匹配或图片加载失败时抛出错误
   */
  async loadDesign(value: unknown): Promise<void> {
    this.emit('status', { message: 'Loading design' })
    try {
      if (
        typeof value === 'object' &&
        value !== null &&
        'version' in value &&
        value.version === 2
      ) {
        await this.loadProductDesign(parseProductDesignDocument(value))
      } else {
        const design = parseDesignDocument(value)
        await this.editor.loadDesign(design)
        const session = this.activeAreaId
          ? this.areaSessions.get(this.activeAreaId)
          : undefined
        if (session) {
          session.design = design
        }
        this.textureBridge.flush()
      }
      this.emit('status', { message: 'Design loaded' })
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /** 当前是否存在可以撤销的设计快照 */
  canUndo(): boolean {
    return this.editor.canUndo
  }

  /** 当前是否存在可以重做的设计快照 */
  canRedo(): boolean {
    return this.editor.canRedo
  }

  /**
   * 恢复上一个设计快照
   *
   * @returns 是否成功恢复了一个历史步骤
   * @throws 历史中的图片无法恢复时抛出错误
   */
  async undo(): Promise<boolean> {
    try {
      const changed = await this.editor.undo()
      if (changed) {
        this.emit('status', { message: 'Undo complete' })
      }
      return changed
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /**
   * 恢复下一个设计快照
   *
   * @returns 是否成功恢复了一个历史步骤
   * @throws 历史中的图片无法恢复时抛出错误
   */
  async redo(): Promise<boolean> {
    try {
      const changed = await this.editor.redo()
      if (changed) {
        this.emit('status', { message: 'Redo complete' })
      }
      return changed
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /** 以当前设计为起点清空撤销与重做历史 */
  clearHistory(): void {
    this.editor.clearHistory()
  }

  /**
   * 将当前二维设计合成为 PNG 并触发浏览器下载
   *
   * @param filename 下载文件名，默认为 `custom-texture.png`
   * @throws 远程图片污染 Canvas 时可能抛出安全错误
   */
  exportTexture(filename?: string): void {
    this.editor.exportTexture(filename)
  }

  /**
   * 返回当前产品按自动评分顺序排列的设计区域
   *
   * 返回值和嵌套质量指标均为副本，修改它们不会影响实例状态
   *
   * @returns 当前产品可编辑区域
   */
  getDesignAreas(): DesignArea[] {
    return this.designAreas.map(({ area }) => ({
      ...area,
      metrics: { ...area.metrics },
    }))
  }

  /** 返回当前二维编辑器对应的区域 ID */
  getActiveDesignAreaId(): string | undefined {
    return this.activeAreaId
  }

  /**
   * 保存当前区域并切换到另一个设计区域
   *
   * 目标区域中的图片完成恢复后 Promise 才会成功，旧区域纹理在切换后保持可见
   *
   * @param areaId 当前产品内的设计区域 ID
   * @throws 区域不存在或目标区域图片无法恢复时抛出错误
   */
  async setActiveDesignArea(areaId: string): Promise<void> {
    if (areaId === this.activeAreaId) {
      return
    }
    const target = this.designAreas.find(({ area }) => area.id === areaId)
    const targetSession = this.areaSessions.get(areaId)
    if (!target || !targetSession) {
      throw new Error('Design area was not found: ' + areaId)
    }
    const previousId = this.activeAreaId
    const previousSession = previousId
      ? this.areaSessions.get(previousId)
      : undefined
    const previousArea = previousId
      ? this.designAreas.find(({ area }) => area.id === previousId)
      : undefined
    if (previousSession) {
      this.textureBridge.flush()
      previousSession.design = this.editor.saveDesign()
      previousSession.history = this.editor.getHistorySnapshot()
      previousSession.viewport = this.editor.getEditorViewport()
    }

    this.activeAreaId = areaId
    this.textureBridge.setActiveArea(areaId)
    try {
      await this.editor.loadDesign(targetSession.design)
      this.editor.setEditorViewport(targetSession.viewport)
      await this.editor.setDesignGuide(
        target.guideLayout,
        this.product.designGuide,
        this.product.textureFlipY,
      )
      this.viewer.setActiveDesignArea(areaId)
      if (targetSession.history) {
        this.editor.restoreHistorySnapshot(targetSession.history)
      } else {
        this.editor.clearHistory()
        targetSession.history = this.editor.getHistorySnapshot()
      }
      this.textureBridge.flush()
      this.emit('activeareachange', {
        area: { ...target.area, metrics: { ...target.area.metrics } },
      })
      this.emit('editorviewportchange', { ...targetSession.viewport })
    } catch (error) {
      let reportedError = error
      if (previousId && previousSession && previousArea) {
        try {
          this.activeAreaId = previousId
          this.textureBridge.setActiveArea(previousId)
          await this.editor.loadDesign(previousSession.design)
          this.editor.setEditorViewport(previousSession.viewport)
          await this.editor.setDesignGuide(
            previousArea.guideLayout,
            this.product.designGuide,
            this.product.textureFlipY,
          )
          this.viewer.setActiveDesignArea(previousId)
          if (previousSession.history) {
            this.editor.restoreHistorySnapshot(previousSession.history)
          } else {
            this.editor.clearHistory()
          }
          this.textureBridge.flush()
        } catch (rollbackError) {
          reportedError = new AggregateError(
            [error, rollbackError],
            'Design area switch failed and the previous area could not be restored',
          )
        }
      }
      this.reportError(reportedError)
      throw reportedError
    }
  }

  /** 返回当前产品是否允许从三维表面切换自动候选区域 */
  isSurfacePickAllowed(): boolean {
    return this.product.designAreas.allowSurfacePick &&
      this.designAreas.some(({ area }) => area.source === 'auto')
  }

  /**
   * 进入三维模型表面选择模式
   *
   * 点击后会切换到命中三角形所属的自动候选区域
   *
   * @throws 产品禁用表面选择或未使用自动区域时抛出错误
   */
  beginSurfacePick(): void {
    if (!this.product.designAreas.allowSurfacePick) {
      throw new Error('Surface picking is disabled for this product')
    }
    if (!this.designAreas.some(({ area }) => area.source === 'auto')) {
      throw new Error('Surface picking requires automatic design areas')
    }
    this.viewer.beginSurfacePick((areaId) => {
      this.emit('surfacepickchange', { active: false })
      void this.setActiveDesignArea(areaId).catch(() => undefined)
    })
    this.emit('surfacepickchange', { active: true })
  }

  /** 取消等待中的三维模型表面选择 */
  cancelSurfacePick(): void {
    const wasActive = this.viewer.isSurfacePickActive()
    this.viewer.cancelSurfacePick()
    if (wasActive) {
      this.emit('surfacepickchange', { active: false })
    }
  }

  /** 返回二维编辑器当前的显示缩放和平移 */
  getEditorViewport(): DesignAreaViewport {
    return this.editor.getEditorViewport()
  }

  /**
   * 设置二维编辑器显示缩放和平移
   *
   * 该操作不修改设计对象坐标、Design JSON、纹理分辨率或三维映射
   *
   * @param viewport 相对于自动适配尺寸的缩放与 CSS 像素平移
   * @throws 数值无效或缩放不在 0.25-4 范围时抛出错误
   */
  setEditorViewport(viewport: DesignAreaViewport): void {
    if (
      ![viewport.zoom, viewport.panX, viewport.panY].every(Number.isFinite) ||
      viewport.zoom < 0.25 ||
      viewport.zoom > 4
    ) {
      throw new RangeError(
        'Editor viewport requires finite values and zoom between 0.25 and 4',
      )
    }
    const next = { ...viewport }
    this.editor.setEditorViewport(next)
    const session = this.activeAreaId
      ? this.areaSessions.get(this.activeAreaId)
      : undefined
    if (session) {
      session.viewport = next
    }
    this.emit('editorviewportchange', next)
  }

  /** 将当前区域完整适配到二维编辑空间并清除平移 */
  fitActiveDesignArea(): void {
    this.setEditorViewport({ zoom: 1, panX: 0, panY: 0 })
  }

  /** 恢复三维产品的默认相机位置 */
  resetView(): void {
    this.viewer.resetView()
  }

  /**
   * 更换模型、基础纹理和接收纹理的目标 Mesh
   *
   * 成功后保留当前设计对象，并将当前设计设为新的历史起点
   *
   * @param product 新的产品配置
   * @throws 模型或纹理加载失败、目标 Mesh 不存在时抛出错误
   */
  async loadProduct(product: ProductConfiguration): Promise<void> {
    const nextProduct = normalizeProductConfiguration(product)
    this.cancelSurfacePick()
    this.emit('status', { message: 'Loading product' })

    try {
      const preservedDesign = this.editor.saveDesign()
      await this.applyProduct(nextProduct, preservedDesign)
      this.product = nextProduct
      this.emit('ready', { product: this.product })
      this.emit('status', {
        message: nextProduct.model || nextProduct.modelUrl
          ? 'Remote product ready'
          : 'Demo product ready',
      })
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /**
   * 释放事件监听、Fabric Canvas、纹理和 WebGL 资源
   *
   * 重复调用不会再次释放资源，首次调用后不得继续使用其他实例方法
   */
  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.stopSelectionListener?.()
    this.stopRenderListener?.()
    this.stopHistoryListener?.()
    this.textureBridge.destroy()
    this.editor.destroy()
    this.viewer.destroy()
  }

  private async initialize(): Promise<void> {
    await this.applyProduct(this.product, this.editor.saveDesign())
    this.emit('ready', { product: this.product })
  }

  private async applyProduct(
    product: ReturnType<typeof normalizeProductConfiguration>,
    preservedDesign: DesignDocument,
  ): Promise<void> {
    const result = await this.viewer.loadProduct(
      product,
      (progress) => this.emit('processingprogress', progress),
    )
    const first = result.designAreas[0]
    if (!first) {
      throw new Error('Product did not provide any design area')
    }

    this.editor.setOutputTransparency(product.designAreas.mode === 'auto')
    await this.editor.setBackgroundTexture(product.textureUrl)
    await this.editor.setDesignGuide(
      first.guideLayout,
      product.designGuide,
      product.textureFlipY,
    )
    this.editor.fitEditorViewport()

    this.designAreas = result.designAreas
    this.modelFingerprint = result.modelFingerprint
    this.areaSessions.clear()
    const emptyDesign: DesignDocument = {
      version: 1,
      canvas: { ...preservedDesign.canvas },
      objects: [],
    }
    result.designAreas.forEach(({ area }, index) => {
      this.areaSessions.set(area.id, {
        design: index === 0
          ? preservedDesign
          : {
              ...emptyDesign,
              canvas: { ...emptyDesign.canvas },
              objects: [],
            },
        viewport: { zoom: 1, panX: 0, panY: 0 },
      })
    })
    this.activeAreaId = first.area.id
    this.viewer.setActiveDesignArea(first.area.id)
    this.textureBridge.configure(
      result.designAreas.map(({ area }) => area.id),
      first.area.id,
      product.textureFlipY,
    )
    this.editor.clearHistory()
    const initialSession = this.areaSessions.get(first.area.id)
    if (initialSession) {
      initialSession.history = this.editor.getHistorySnapshot()
    }
    this.emit('designguidechange', {
      visible: this.editor.isDesignGuideVisible(),
    })
    this.emit('designareaschange', { areas: this.getDesignAreas() })
    this.emit('activeareachange', {
      area: { ...first.area, metrics: { ...first.area.metrics } },
    })
    this.emit('editorviewportchange', { zoom: 1, panX: 0, panY: 0 })
  }

  private async loadProductDesign(
    design: ProductDesignDocument,
  ): Promise<void> {
    if (design.processorVersion !== DESIGN_AREA_PROCESSOR_VERSION) {
      throw new Error('Design document uses a different area processor version')
    }
    if (design.modelFingerprint !== this.modelFingerprint) {
      throw new Error('Design document belongs to a different product model')
    }
    const currentAreaIds = new Set(
      this.designAreas.map(({ area }) => area.id),
    )
    if (
      design.areas.length !== currentAreaIds.size ||
      design.areas.some(({ areaId }) => !currentAreaIds.has(areaId))
    ) {
      throw new Error('Design document areas do not match the current product')
    }
    for (const area of design.areas) {
      const currentArea = this.designAreas.find(
        ({ area: candidate }) => candidate.id === area.areaId,
      )
      if (
        !currentArea ||
        area.areaFingerprint !== currentArea.areaFingerprint
      ) {
        throw new Error('Design area fingerprint does not match: ' + area.areaId)
      }
    }

    const previousActiveId = this.activeAreaId
    const previousActiveSession = previousActiveId
      ? this.areaSessions.get(previousActiveId)
      : undefined
    if (previousActiveSession) {
      previousActiveSession.design = this.editor.saveDesign()
      previousActiveSession.history = this.editor.getHistorySnapshot()
      previousActiveSession.viewport = this.editor.getEditorViewport()
    }
    const previousSessions = new Map<string, DesignAreaSession>(
      [...this.areaSessions].map(([areaId, session]) => [
        areaId,
        {
          design: structuredClone(session.design),
          history: session.history
            ? structuredClone(session.history)
            : undefined,
          viewport: { ...session.viewport },
        },
      ]),
    )
    const currentCanvas = this.editor.saveDesign().canvas
    if (
      design.areas.some(({ canvas }) =>
        canvas.width !== currentCanvas.width ||
        canvas.height !== currentCanvas.height,
      )
    ) {
      throw new RangeError(
        'Design area canvas dimensions do not match the current editor',
      )
    }
    const nextDesigns = new Map<string, DesignDocument>(
      design.areas.map((area) => [
        area.areaId,
        {
          version: 1 as const,
          canvas: { ...area.canvas },
          objects: structuredClone(area.objects),
        },
      ]),
    )
    const orderedAreaIds = [
      ...design.areas
        .map(({ areaId }) => areaId)
        .filter((areaId) => areaId !== design.activeAreaId),
      design.activeAreaId,
    ]
    const target = this.designAreas.find(
      ({ area }) => area.id === design.activeAreaId,
    )
    if (!target) {
      throw new Error('Active design area was not found after validation')
    }
    try {
      await this.renderAreaDocuments(nextDesigns, orderedAreaIds)
      await this.editor.setDesignGuide(
        target.guideLayout,
        this.product.designGuide,
        this.product.textureFlipY,
      )
    } catch (error) {
      let reportedError = error
      if (previousActiveId) {
        try {
          const previousDesigns = new Map(
            [...previousSessions].map(([areaId, session]) => [
              areaId,
              session.design,
            ]),
          )
          const restoreOrder = [
            ...[...previousDesigns.keys()].filter(
              (areaId) => areaId !== previousActiveId,
            ),
            previousActiveId,
          ]
          await this.renderAreaDocuments(previousDesigns, restoreOrder)
          const previousArea = this.designAreas.find(
            ({ area }) => area.id === previousActiveId,
          )
          const previousSession = previousSessions.get(previousActiveId)
          if (!previousArea || !previousSession) {
            throw new Error('Previous design area state was not found')
          }
          this.editor.setEditorViewport(previousSession.viewport)
          await this.editor.setDesignGuide(
            previousArea.guideLayout,
            this.product.designGuide,
            this.product.textureFlipY,
          )
          this.viewer.setActiveDesignArea(previousActiveId)
          if (previousSession.history) {
            this.editor.restoreHistorySnapshot(previousSession.history)
          } else {
            this.editor.clearHistory()
          }
          this.textureBridge.flush()
        } catch (rollbackError) {
          reportedError = new AggregateError(
            [error, rollbackError],
            'Product design load failed and the previous design could not be restored',
          )
        }
      }
      throw reportedError
    }

    for (const [areaId, document] of nextDesigns) {
      const session = this.areaSessions.get(areaId)
      if (session) {
        session.design = document
        session.history = undefined
        session.viewport = { zoom: 1, panX: 0, panY: 0 }
      }
    }
    this.activeAreaId = design.activeAreaId
    this.textureBridge.setActiveArea(design.activeAreaId)
    this.viewer.setActiveDesignArea(design.activeAreaId)
    this.editor.fitEditorViewport()
    this.editor.clearHistory()
    const activeSession = this.areaSessions.get(design.activeAreaId)
    if (activeSession) {
      activeSession.history = this.editor.getHistorySnapshot()
    }
    this.emit('activeareachange', {
      area: { ...target.area, metrics: { ...target.area.metrics } },
    })
    this.emit('editorviewportchange', { zoom: 1, panX: 0, panY: 0 })
  }

  private async renderAreaDocuments(
    documents: Map<string, DesignDocument>,
    order: string[],
  ): Promise<void> {
    for (const areaId of order) {
      const document = documents.get(areaId)
      if (!document) {
        throw new Error('Design area document was not found: ' + areaId)
      }
      this.activeAreaId = areaId
      this.textureBridge.setActiveArea(areaId)
      await this.editor.loadDesign(document)
      this.textureBridge.flush()
    }
  }

  private emit<K extends CustomizerEventName>(
    event: K,
    detail: CustomizerEventMap[K],
  ): void {
    this.events.dispatchEvent(new CustomEvent(event, { detail }))
  }

  private reportError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error))
    this.emit('error', { error: normalized })
    this.emit('status', { message: normalized.message })
  }
}
