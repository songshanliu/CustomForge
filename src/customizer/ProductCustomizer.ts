import { normalizeProductConfiguration } from '../core/config'
import { resolveElement } from '../core/dom'
import type {
  AddImageOptions,
  AddTextOptions,
  CustomizerEventMap,
  CustomizerEventName,
  CustomizerOptions,
  ProductConfiguration,
} from '../core/types'
import { DesignEditor } from '../editor/DesignEditor'
import { TextureBridge } from '../bridge/TextureBridge'
import { ProductViewer } from '../viewer/ProductViewer'

type EventListener<K extends CustomizerEventName> = (
  detail: CustomizerEventMap[K],
) => void

/**
 * 统一管理二维编辑器、三维查看器和实时纹理同步
 *
 * 每个实例独立持有 DOM 事件、Fabric 状态和 WebGL 资源
 * 不再使用实例时必须调用 `destroy()`
 */
export class ProductCustomizer {
  /** 当前实例使用的二维设计编辑器 */
  readonly editor: DesignEditor

  /** 当前实例使用的三维产品查看器 */
  readonly viewer: ProductViewer

  private readonly events = new EventTarget()
  private readonly textureBridge: TextureBridge
  private product: ReturnType<typeof normalizeProductConfiguration>
  private readonly stopSelectionListener: () => void
  private readonly stopRenderListener: () => void

  private constructor(options: CustomizerOptions) {
    const editorHost = resolveElement(options.editor, 'Editor')
    const viewerHost = resolveElement(options.viewer, 'Viewer')

    this.product = normalizeProductConfiguration(options.product)
    this.editor = new DesignEditor(editorHost, {
      width: options.editorWidth ?? 1024,
      height: options.editorHeight ?? 512,
    })
    this.viewer = new ProductViewer(viewerHost)
    this.textureBridge = new TextureBridge(
      this.editor,
      this.viewer,
      this.product.textureFlipY,
    )

    this.stopSelectionListener = this.editor.onSelectionChange((hasSelection) => {
      this.emit('selectionchange', { hasSelection })
    })
    this.stopRenderListener = this.editor.onRender(() => {
      this.emit('change', { objectCount: this.editor.objectCount })
    })
  }

  /**
   * 创建实例并完成初始产品加载
   *
   * @param options 产品定制器初始化配置
   * @returns 初始化完成的产品定制器实例
   * @throws 初始化失败时自动释放已创建资源并继续抛出原始错误
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
   * @param options 文字内容、位置和样式配置
   */
  addText(options?: AddTextOptions): void {
    this.editor.addText(options)
  }

  /**
   * 加载图片并将其添加到二维画布
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
   * 删除二维编辑器中的当前对象或选区
   *
   * @returns 是否删除了至少一个对象
   */
  deleteSelected(): boolean {
    return this.editor.deleteSelected()
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

  /**
   * 更换模型、基础纹理和接收纹理的目标 Mesh
   *
   * @param product 新的产品配置
   * @throws 模型或纹理加载失败、目标 Mesh 不存在时抛出错误
   */
  async loadProduct(product: ProductConfiguration): Promise<void> {
    const nextProduct = normalizeProductConfiguration(product)
    this.emit('status', { message: 'Loading product' })

    try {
      await this.viewer.loadProduct(nextProduct)
      await this.editor.setBackgroundTexture(nextProduct.textureUrl)
      this.textureBridge.setFlipY(nextProduct.textureFlipY)
      this.product = nextProduct
      this.emit('ready', { product: this.product })
      this.emit('status', { message: nextProduct.modelUrl ? 'Remote product ready' : 'Demo product ready' })
    } catch (error) {
      this.reportError(error)
      throw error
    }
  }

  /**
   * 释放事件监听、Fabric Canvas、纹理和 WebGL 资源
   *
   * 调用后不得继续使用当前实例
   */
  destroy(): void {
    this.stopSelectionListener?.()
    this.stopRenderListener?.()
    this.textureBridge.destroy()
    this.editor.destroy()
    this.viewer.destroy()
  }

  private async initialize(): Promise<void> {
    await this.viewer.loadProduct(this.product)
    await this.editor.setBackgroundTexture(this.product.textureUrl)
    this.textureBridge.setFlipY(this.product.textureFlipY)
    this.emit('ready', { product: this.product })
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
