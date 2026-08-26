import type { ProductConfiguration } from './types'

/** 默认接收实时纹理的 Mesh 名称 */
export const DEFAULT_SURFACE_MESH = 'PrintArea'

/**
 * 完成默认值补全后的内部产品配置
 */
export interface NormalizedProductConfiguration {
  /** 清理空白后的模型地址 */
  modelUrl?: string

  /** 清理空白后的基础纹理地址 */
  textureUrl?: string

  /** 接收实时纹理的 Mesh 名称 */
  surfaceMesh: string

  /** 是否垂直翻转 CanvasTexture */
  textureFlipY: boolean
}

/**
 * 清理产品配置并补全运行所需的默认值
 *
 * 远程模型默认不翻转纹理，内置演示模型默认翻转纹理
 *
 * @param product 外部传入的产品配置
 * @returns 可以直接交给编辑器和查看器使用的完整配置
 */
export function normalizeProductConfiguration(
  product: ProductConfiguration = {},
): NormalizedProductConfiguration {
  const modelUrl = product.modelUrl?.trim() || undefined
  const textureUrl = product.textureUrl?.trim() || undefined
  const surfaceMesh = product.surfaceMesh?.trim() || DEFAULT_SURFACE_MESH

  return {
    modelUrl,
    textureUrl,
    surfaceMesh,
    textureFlipY: product.textureFlipY ?? !modelUrl,
  }
}
