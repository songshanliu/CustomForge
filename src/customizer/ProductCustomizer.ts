import { normalizeProductConfiguration } from '../core/config'
import type {
  CustomizerEventListener,
  ProductCustomizerApi,
} from '../core/api'
import { resolveElement } from '../core/dom'
import type {
  AddImageOptions,
  AddTextOptions,
  CanvasBounds,
  CustomizerEventMap,
  CustomizerEventName,
  CustomizerOptions,
  CustomizerState,
  DesignCanvas,
  DesignDocument,
  DesignObject,
  ImageDesignObject,
  ProductConfiguration,
  ProductViewState,
  ResolvedProductConfiguration,
  TextDesignObject,
  UpdateObjectTransformOptions,
  UpdateTextOptions,
} from '../core/types'
import { DesignEditor } from '../editor/DesignEditor'
import { TextureBridge } from '../bridge/TextureBridge'
import { ProductViewer } from '../viewer/ProductViewer'

/**
 * 统一管理二维编辑器、三维查看器和实时纹理同步
 *
 * 仅支持具有 DOM、Canvas、WebGL 和 ResizeObserver 的浏览器环境
 * 每个实例独立持有 DOM 事件、Fabric 状态和 WebGL 资源
 * 不再使用实例时必须调用 `destroy()`
 */
export class ProductCustomizer implements ProductCustomizerApi {
  private readonly events = new EventTarget()
  private readonly textureBridge: TextureBridge
  private readonly editor: DesignEditor
  private readonly viewer: ProductViewer
  private product: ReturnType<typeof normalizeProductConfiguration>
  private readonly stopSelectionListener: () => void
  private readonly stopRenderListener: () => void
  private readonly stopHistoryListener: () => void
  private readonly stopViewListener: () => void
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

    this.product = normalizeProductConfiguration(options.product)
    this.editor = new DesignEditor(editorHost, {
      width: options.editorWidth ?? 1024,
      height: options.editorHeight ?? 512,
      historyLimit,
      ariaLabel: options.editorAriaLabel,
      defaultText: options.defaultText,
      textObjectName: options.textObjectName,
      imageObjectName: options.imageObjectName,
      backgroundObjectName: options.backgroundObjectName,
      appearance: options.appearance?.editor,
    })
    this.viewer = new ProductViewer(
      viewerHost,
      options.viewerAriaLabel,
      options.appearance?.viewer,
    )
    this.textureBridge = new TextureBridge(
      this.editor,
      this.viewer,
      this.product.textureFlipY,
    )

    this.stopSelectionListener = this.editor.onSelectionChange((objectIds) => {
      this.emit('selectionchange', {
        hasSelection: objectIds.length > 0,
        objectIds,
      })
    })
    this.stopRenderListener = this.editor.onRender(() => {
      this.emit('change', { objectCount: this.editor.objectCount })
    })
    this.stopHistoryListener = this.editor.onHistoryChange((state) => {
      this.emit('historychange', state)
    })
    this.stopViewListener = this.viewer.onViewChange((state) => {
      this.emit('viewchange', state)
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
    listener: CustomizerEventListener<K>,
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
   * @returns 创建后的可持久化文字对象快照
   */
  addText(options?: AddTextOptions): TextDesignObject {
    return this.editor.addText(options)
  }

  /**
   * 加载图片并将其添加到二维画布
   *
   * role 为 background 时会替换已有设计背景、铺满当前 UV 可打印区域并默认锁定在最底层
   * 创建后和用户变换期间，对象会自动缩放或平移以保持完整可见
   *
   * @param options 图片地址、位置和显示宽度
   * @returns 创建后的可持久化图片对象快照
   * @throws 图片无法访问、加载失败或被 CORS 策略阻止时抛出错误
   */
  async addImage(options: AddImageOptions): Promise<ImageDesignObject> {
    try {
      return await this.editor.addImage(options)
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /** 返回产品、画布、对象、选区、历史和视角的独立状态快照 */
  getState(): CustomizerState {
    return {
      product: this.getProduct(),
      canvas: this.getCanvasSize(),
      printableBounds: this.getPrintableBounds(),
      objects: this.getObjects(),
      selectedObjectIds: this.getSelectedObjectIds(),
      history: {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
      },
      view: this.getViewState(),
    }
  }

  /** 返回当前补全默认值后的产品配置独立快照 */
  getProduct(): ResolvedProductConfiguration {
    return { ...this.product }
  }

  /** 返回当前二维逻辑画布尺寸 */
  getCanvasSize(): DesignCanvas {
    return this.editor.getCanvasSize()
  }

  /** 返回当前产品 UV 在逻辑画布中的可打印包围框 */
  getPrintableBounds(): CanvasBounds {
    return this.editor.getPrintableBounds()
  }

  /**
   * 返回当前可编辑对象的独立快照
   *
   * @returns 按画布层级从后到前排列的 Design JSON 对象
   */
  getObjects(): DesignObject[] {
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
   * 按稳定 ID 同时选中多个可见对象
   *
   * 所有 ID 都必须有效且可见，否则保持原选区不变；空数组清除选区
   *
   * @param ids Design JSON 中的对象 ID
   * @returns 是否应用了请求的选区
   */
  selectObjects(ids: readonly string[]): boolean {
    return this.editor.selectObjects(ids)
  }

  /**
   * 清除当前画布选区，不修改设计内容或历史记录
   *
   * @returns 清除前是否存在选中对象
   */
  clearSelection(): boolean {
    return this.editor.clearSelection()
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
   * 将现有图片转换为铺满当前 UV 可打印区域的设计背景
   *
   * 转换会替换已有设计背景、重置旋转、锁定对象并移动到最底层
   *
   * @param id Design JSON 中的图片对象 ID
   * @returns 是否找到普通图片并完成转换
   */
  setImageAsBackground(id: string): boolean {
    return this.editor.setImageAsBackground(id)
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

  /**
   * 更新对象中心位置、缩放、旋转和翻转
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
    return this.editor.updateObjectTransform(id, options)
  }

  /**
   * 修改已有文字对象的内容和排版样式
   *
   * 连续调用会在短暂空闲后合并为一个撤销步骤
   *
   * @param id Design JSON 中的对象 ID
   * @param options 要修改的文字属性，未传字段保持不变
   * @returns 是否找到并更新了文字对象
   * @throws 字号、行高、字距、字重或 CSS 颜色不符合约束时抛出错误
   */
  updateText(id: string, options: UpdateTextOptions): boolean {
    return this.editor.updateText(id, options)
  }

  /**
   * 让一个未锁定文字对象进入画布内联编辑状态
   *
   * @param id Design JSON 中的对象 ID
   * @returns 是否找到文字对象并进入编辑状态
   */
  editText(id: string): boolean {
    return this.editor.editText(id)
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
   * 创建当前二维设计的版本化 JSON 快照
   *
   * 快照不包含产品模型、目标 Mesh 或基础纹理配置
   * Blob URL 图片会在添加时转换为 Data URL，因此返回值可以跨页面会话保存
   *
   * @returns 可以安全传给 JSON.stringify 的 DesignDocument
   * @throws 设计中存在不支持的对象或文字填充时抛出错误
   */
  saveDesign(): DesignDocument {
    return this.editor.saveDesign()
  }

  /**
   * 校验并恢复版本化 Design JSON
   *
   * 图片全部加载成功后才替换当前二维对象，产品和基础纹理保持不变
   * 输入画布尺寸必须与当前编辑器的逻辑尺寸完全一致
   *
   * @param value JSON.parse 结果或符合 DesignDocument 的对象
   * @throws Schema 无效、画布尺寸不匹配或图片加载失败时抛出错误
   */
  async loadDesign(value: unknown): Promise<void> {
    this.emit('status', { message: 'Loading design' })
    try {
      await this.editor.loadDesign(value)
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
   * 返回当前合成纹理的 PNG Data URL
   *
   * 结果与逻辑画布同尺寸，不包含选择框和 UV 辅助层
   *
   * @returns PNG Data URL
   * @throws 远程图片污染 Canvas 时抛出安全错误
   */
  getTextureDataUrl(): string {
    return this.editor.getTextureDataUrl()
  }

  /**
   * 异步返回当前合成纹理的 PNG Blob
   *
   * 结果与逻辑画布同尺寸，不包含选择框和 UV 辅助层
   *
   * @returns PNG Blob
   * @throws 远程图片污染 Canvas 或浏览器无法编码时抛出错误
   */
  getTextureBlob(): Promise<Blob> {
    return this.editor.getTextureBlob()
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

  /** 恢复三维产品的默认相机位置 */
  resetView(): void {
    this.viewer.resetView()
  }

  /** 返回当前三维相机位置和观察目标点 */
  getViewState(): ProductViewState {
    return this.viewer.getViewState()
  }

  /**
   * 恢复三维观察视角
   *
   * @param state 要恢复的相机位置和观察目标点
   * @returns 应用后的独立视角快照
   * @throws 坐标不是有限数值或相机与目标点重合时抛出错误
   */
  setViewState(state: ProductViewState): ProductViewState {
    return this.viewer.setViewState(state)
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
    this.emit('status', { message: 'Loading product' })

    try {
      const uvLayout = await this.viewer.loadProduct(nextProduct)
      await this.editor.setBackgroundTexture(nextProduct.textureUrl)
      this.textureBridge.setFlipY(nextProduct.textureFlipY)
      this.editor.setUvLayout(uvLayout, nextProduct.textureFlipY)
      this.product = nextProduct
      this.editor.clearHistory()
      this.emit('ready', { product: this.getProduct() })
      this.emit('status', { message: nextProduct.modelUrl ? 'Remote product ready' : 'Demo product ready' })
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
    this.stopViewListener?.()
    this.textureBridge.destroy()
    this.editor.destroy()
    this.viewer.destroy()
  }

  private async initialize(): Promise<void> {
    const uvLayout = await this.viewer.loadProduct(this.product)
    await this.editor.setBackgroundTexture(this.product.textureUrl)
    this.textureBridge.setFlipY(this.product.textureFlipY)
    this.editor.setUvLayout(uvLayout, this.product.textureFlipY)
    this.emit('ready', { product: this.getProduct() })
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
