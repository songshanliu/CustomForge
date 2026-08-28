import type {
  DesignGuideArea,
  ProductConfiguration,
  ProductDesignAreaConfiguration,
  ProductDesignAreaStrategy,
  ProductDesignGuideConfiguration,
  ProductModelSource,
} from './types'

/** 默认接收实时纹理的 Mesh 名称 */
export const DEFAULT_SURFACE_MESH = 'PrintArea'

/**
 * 完成默认值补全后的内部产品配置
 */
export interface NormalizedProductConfiguration {
  /** 归一化后的模型来源，Blob 和 ArrayBuffer 保持调用方传入的对象 */
  model?: ProductModelSource

  /** 清理空白后的模型地址 */
  modelUrl?: string

  /** 清理空白后的基础纹理地址 */
  textureUrl?: string

  /** 接收实时纹理的 Mesh 名称 */
  surfaceMesh: string

  /** 是否垂直翻转 CanvasTexture，自动模式固定为 false */
  textureFlipY: boolean

  /** 完成默认值和归一化校验后的二维辅助配置 */
  designGuide: NormalizedProductDesignGuideConfiguration

  /** 完成默认值和范围校验后的设计区域配置 */
  designAreas: NormalizedProductDesignAreaConfiguration
}

/** 完成默认值和范围校验后的产品设计区域配置 */
export interface NormalizedProductDesignAreaConfiguration {
  /** 设计区域生成模式 */
  mode: 'auto' | 'existing-uv'

  /** 自动模式最多保留的候选数量 */
  maxAreas: number

  /** 每个区域纹理的建议边长，单位为像素 */
  textureSize: number

  /** 自动候选评分侧重 */
  strategy: ProductDesignAreaStrategy

  /** 是否允许通过三维点击切换候选区域 */
  allowSurfacePick: boolean
}

/** 完成默认值和路径清理后的产品设计辅助配置 */
export interface NormalizedProductDesignGuideConfiguration {
  /** 初次加载产品时是否显示辅助层 */
  visible: boolean

  /** 是否显示从目标 Mesh 提取的 UV 岛边界 */
  showUv: boolean

  /** 清理空白后的可选模板地址 */
  templateUrl?: string

  /** 归一化安全区 */
  safeArea?: DesignGuideArea

  /** 归一化出血区 */
  bleedArea?: DesignGuideArea
}

function normalizeGuideArea(
  area: DesignGuideArea | undefined,
  name: string,
): DesignGuideArea | undefined {
  if (!area) {
    return undefined
  }

  const values = [area.x, area.y, area.width, area.height]
  if (!values.every(Number.isFinite)) {
    throw new RangeError(`${name} values must be finite numbers`)
  }
  if (
    area.x < 0 ||
    area.y < 0 ||
    area.width <= 0 ||
    area.height <= 0 ||
    area.x + area.width > 1 ||
    area.y + area.height > 1
  ) {
    throw new RangeError(`${name} must stay within normalized canvas bounds`)
  }

  return { ...area }
}

function normalizeDesignGuide(
  guide: ProductDesignGuideConfiguration | undefined,
): NormalizedProductDesignGuideConfiguration {
  return {
    visible: guide?.visible ?? true,
    showUv: guide?.showUv ?? true,
    templateUrl: guide?.templateUrl?.trim() || undefined,
    safeArea: normalizeGuideArea(guide?.safeArea, 'designGuide.safeArea'),
    bleedArea: normalizeGuideArea(guide?.bleedArea, 'designGuide.bleedArea'),
  }
}

function normalizeDesignAreas(
  configuration: ProductDesignAreaConfiguration | undefined,
  hasModel: boolean,
  hasExplicitSurface: boolean,
): NormalizedProductDesignAreaConfiguration {
  const mode = configuration?.mode ??
    (hasModel && !hasExplicitSurface ? 'auto' : 'existing-uv')
  const maxAreas = configuration?.maxAreas ?? 4
  if (!Number.isInteger(maxAreas) || maxAreas < 1 || maxAreas > 8) {
    throw new RangeError('designAreas.maxAreas must be an integer between 1 and 8')
  }
  const textureSize = configuration?.textureSize ?? 1024
  if (
    !Number.isInteger(textureSize) ||
    textureSize < 256 ||
    textureSize > 4096 ||
    (textureSize & (textureSize - 1)) !== 0
  ) {
    throw new RangeError(
      'designAreas.textureSize must be a power of two between 256 and 4096',
    )
  }
  return {
    mode,
    maxAreas,
    textureSize,
    strategy: configuration?.strategy ?? 'balanced',
    allowSurfacePick: configuration?.allowSurfacePick ?? true,
  }
}

/**
 * 清理产品配置并补全运行所需的默认值
 *
 * 自动区域固定使用生成 UV 的纹理方向，existing-uv 远程模型默认不翻转纹理，
 * 内置演示模型默认翻转纹理
 *
 * @param product 外部传入的产品配置
 * @returns 可以直接交给编辑器和查看器使用的完整配置
 */
export function normalizeProductConfiguration(
  product: ProductConfiguration = {},
): NormalizedProductConfiguration {
  if (product.model !== undefined && product.modelUrl !== undefined) {
    throw new Error('product.model and product.modelUrl cannot be used together')
  }
  const model = typeof product.model === 'string'
    ? product.model.trim() || undefined
    : product.model
  const modelUrl = product.modelUrl?.trim() || undefined
  const textureUrl = product.textureUrl?.trim() || undefined
  const explicitSurfaceMesh = product.surfaceMesh?.trim() || undefined
  const surfaceMesh = explicitSurfaceMesh ?? DEFAULT_SURFACE_MESH
  const hasModel = model !== undefined || modelUrl !== undefined
  const designAreas = normalizeDesignAreas(
    product.designAreas,
    hasModel,
    explicitSurfaceMesh !== undefined,
  )

  return {
    model,
    modelUrl,
    textureUrl,
    surfaceMesh,
    textureFlipY: designAreas.mode === 'auto'
      ? false
      : product.textureFlipY ?? !hasModel,
    designGuide: normalizeDesignGuide(product.designGuide),
    designAreas,
  }
}
