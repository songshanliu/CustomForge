import { ProductCustomizer } from './customizer/ProductCustomizer'
import type { CustomizerOptions } from './core/types'

/**
 * 创建产品定制器实例并完成模型、编辑器和纹理同步初始化
 *
 * @param options 编辑器容器、查看器容器和产品资源配置
 * @returns 初始化完成的产品定制器实例
 * @throws DOM 容器不存在、模型加载失败或目标 Mesh 不存在时抛出错误
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
): Promise<ProductCustomizer> {
  return ProductCustomizer.create(options)
}

export { ProductCustomizer }
export type {
  AddImageOptions,
  AddTextOptions,
  CustomizerEventMap,
  CustomizerOptions,
  ProductConfiguration,
} from './core/types'
