import './style.css'
import { ProductCustomizer } from './customizer/ProductCustomizer'
import type { ProductCustomizerApi } from './core/api'
import type { CustomizerOptions } from './core/types'

/**
 * 创建产品定制器实例并完成模型、编辑器和纹理同步初始化
 *
 * 仅支持浏览器环境，应在 DOM 挂载容器可用后调用
 * 编辑器和查看器必须使用两个不同的容器
 * initialDesign 和主动启用的模型元数据会在分配二维画布前解析，尺寸必须满足像素与设备限制
 * 远程模型和图片必须允许跨域访问，图片未满足 CORS 时不能安全导出 PNG
 * 不再使用返回的实例时必须调用 `destroy()` 释放资源
 *
 * @param options 编辑器容器、查看器容器和产品资源配置
 * @returns 初始化完成的产品定制器实例
 * @throws DOM 容器无效、模型加载失败、尺寸超限或设计映射冲突时清理已创建资源并抛出错误
 *
 * @example
 * ```ts
 * const customizer = await createCustomizer({
 *   editor: '#editor',
 *   viewer: '#viewer',
 *   product: {
 *     modelUrl: 'https://example.com/product.glb',
 *     surfaceMesh: 'PrintArea',
 *   },
 * })
 * ```
 */
export async function createCustomizer(
  options: CustomizerOptions,
): Promise<ProductCustomizerApi> {
  return ProductCustomizer.create(options)
}

export { ProductCustomizer }
export { PrintSurfaceError } from './core/printErrors'
export type {
  CustomizerEventListener,
  ProductCustomizerApi,
} from './core/api'
export type {
  AddImageOptions,
  AddTextOptions,
  CanvasBounds,
  CustomizerAppearance,
  CustomizerEventMap,
  CustomizerEventName,
  CustomizerOptions,
  CustomizerState,
  DesignCanvas,
  DesignDocument,
  DesignDocumentV1,
  DesignDocumentV2,
  DesignPrintMapping,
  DesignImageRole,
  DesignObject,
  DesignObjectState,
  DesignObjectTransform,
  ElementTarget,
  ImageDesignObject,
  EditorAppearance,
  EditorViewOptions,
  EditorViewState,
  HistoryState,
  ProductConfiguration,
  PrintConfigurationSource,
  PrintDiagnostic,
  PrintDiagnosticCode,
  PrintSurfaceInfo,
  PrintUvChannel,
  PrintUvMapping,
  ProductViewState,
  ResolvedProductConfiguration,
  TextAlignment,
  TextDesignObject,
  TextFontStyle,
  TextFontWeight,
  UpdateObjectTransformOptions,
  UpdateTextOptions,
  UvDomain,
  Vector3Value,
  ViewerAppearance,
} from './core/types'
