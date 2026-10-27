import { PrintSurfaceError } from './printErrors'
import type { DesignCanvas, DesignPrintMapping, PrintUvChannel, PrintUvMapping, UvDomain } from './types'
import type { UvLayout } from './uv'

/** 单边逻辑像素上限，还需同时满足设备纹理上限与面积上限 */
export const MAX_CANVAS_DIMENSION = 8192
/** 逻辑像素面积上限，不随 CSS 显示尺寸改变 */
export const MAX_CANVAS_PIXELS = 16_777_216

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

/** 校验原始 UV 参考域，不接受近似零跨度或非有限数值 */
export function readUvDomain(value: unknown): UvDomain {
  const input = record(value, 'uvMapping.domain')
  const domain = { minU: input.minU, minV: input.minV, maxU: input.maxU, maxV: input.maxV }
  if (!Object.values(domain).every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    throw new PrintSurfaceError('PRINT_UV_DOMAIN_DEGENERATE', 'UV domain must contain four finite numbers')
  }
  const result = domain as UvDomain
  const spanU = result.maxU - result.minU
  const spanV = result.maxV - result.minV
  if (!Number.isFinite(spanU) || !Number.isFinite(spanV) || spanU <= 1e-8 || spanV <= 1e-8) {
    throw new PrintSurfaceError('PRINT_UV_DOMAIN_DEGENERATE', 'UV domain must have positive, non-degenerate U and V spans')
  }
  return result
}

/** 校验 UV 通道；不存在的几何属性在模型提取时另行拒绝 */
export function readUvChannel(value: unknown): PrintUvChannel {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
    throw new TypeError('uvChannel must be 0, 1, 2, or 3')
  }
  return value
}

/** 净化映射配置，不保存调用方的可变 domain 引用 */
export function readUvMapping(value: unknown): PrintUvMapping {
  const input = record(value, 'uvMapping')
  if (input.mode === 'original' || input.mode === 'fit-bounds') return { mode: input.mode }
  if (input.mode === 'domain') return { mode: 'domain', domain: readUvDomain(input.domain) }
  throw new TypeError('uvMapping.mode must be original, fit-bounds, or domain')
}

/** 在分配画布前校验成对整数尺寸、面积与设备纹理上限 */
export function validateCanvasSize(width: unknown, height: unknown, deviceLimit = MAX_CANVAS_DIMENSION): DesignCanvas {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new PrintSurfaceError('CANVAS_SIZE_INVALID', 'Canvas width and height must be positive integers')
  }
  const limit = Math.min(MAX_CANVAS_DIMENSION, deviceLimit)
  if (width > limit || height > limit || width * height > MAX_CANVAS_PIXELS) {
    throw new PrintSurfaceError('CANVAS_SIZE_LIMIT', `Canvas exceeds the ${limit}px side or ${MAX_CANVAS_PIXELS} pixel area limit`)
  }
  return { width, height }
}

/** 校验 Schema 2 数值映射，不保留未知字段或模型地址 */
export function readDesignPrintMapping(value: unknown): DesignPrintMapping {
  const input = record(value, 'design.printMapping')
  if (input.version !== 1) throw new TypeError('design.printMapping.version must be 1')
  if (typeof input.surfaceMesh !== 'string' || !input.surfaceMesh.trim()) throw new TypeError('design.printMapping.surfaceMesh must be a non-empty string')
  if (typeof input.textureFlipY !== 'boolean') throw new TypeError('design.printMapping.textureFlipY must be a boolean')
  if (input.modelRevision !== undefined && (typeof input.modelRevision !== 'string' || !input.modelRevision.trim())) throw new TypeError('design.printMapping.modelRevision must be a non-empty string')
  return {
    version: 1,
    surfaceMesh: input.surfaceMesh.trim(),
    uvChannel: readUvChannel(input.uvChannel),
    domain: readUvDomain(input.domain),
    textureFlipY: input.textureFlipY,
    ...(input.modelRevision === undefined ? {} : { modelRevision: (input.modelRevision as string).trim() }),
  }
}

/** 读取所有实际三角形的整体范围，不统计未使用的顶点 */
export function getRawUvBounds(layout: UvLayout): UvDomain {
  const values = layout.triangleCoordinates
  if (values.length === 0 || values.length % 6 !== 0) {
    throw new PrintSurfaceError('PRINT_UV_INVALID', 'Print surface must contain complete UV triangles')
  }
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity
  for (let index = 0; index < values.length; index += 2) {
    const u = values[index], v = values[index + 1]
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new PrintSurfaceError('PRINT_UV_INVALID', 'Print surface contains non-finite UV coordinates')
    minU = Math.min(minU, u); maxU = Math.max(maxU, u)
    minV = Math.min(minV, v); maxV = Math.max(maxV, v)
  }
  return { minU, minV, maxU, maxV }
}

/** 对全部 UV 岛执行同一个仿射转换，不修改原始布局或几何 UV */
export function transformUvLayout(layout: UvLayout, domain: UvDomain): UvLayout {
  readUvDomain(domain)
  const spanU = domain.maxU - domain.minU, spanV = domain.maxV - domain.minV
  const transform = (input: Float32Array): Float32Array => {
    const output = new Float32Array(input.length)
    for (let index = 0; index < input.length; index += 2) {
      output[index] = (input[index] - domain.minU) / spanU
      output[index + 1] = (input[index + 1] - domain.minV) / spanV
      if (!Number.isFinite(output[index]) || !Number.isFinite(output[index + 1])) {
        throw new PrintSurfaceError('PRINT_UV_INVALID', 'Transformed UV coordinates exceed the supported finite range')
      }
    }
    return output
  }
  return { triangleCoordinates: transform(layout.triangleCoordinates), boundaryCoordinates: transform(layout.boundaryCoordinates) }
}

/** 比较已解析数值域，容许提取 Float32 UV 引入的舍入误差 */
export function equalUvDomains(a: UvDomain, b: UvDomain): boolean {
  return (['minU', 'minV', 'maxU', 'maxV'] as const).every((key) => Math.abs(a[key] - b[key]) <= 1e-7 * Math.max(1, Math.abs(a[key]), Math.abs(b[key])))
}

/** 拒绝静默使用不同的节点、通道、方向、域或已知模型内容版本 */
export function assertDesignMappingMatches(saved: DesignPrintMapping, current: DesignPrintMapping): void {
  if (saved.surfaceMesh !== current.surfaceMesh || saved.uvChannel !== current.uvChannel || saved.textureFlipY !== current.textureFlipY || !equalUvDomains(saved.domain, current.domain) || (saved.modelRevision !== undefined && current.modelRevision !== undefined && saved.modelRevision !== current.modelRevision)) {
    throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Design mapping does not match the current product; create an instance with initialDesign or migrate explicitly')
  }
}

/**
 * 校验运行时恢复映射并保留文档版本，不将旧文档声明当作当前模型的内容证明
 *
 * @param saved 待恢复文档中的数值映射
 * @param current 当前实例的数值映射，可能包含初始化文档继承的未验证版本
 * @param modelRevision 宿主为当前实际模型提供的版本，缺省时只校验节点与数值映射
 * @returns 文档映射的独立副本，保留文档自身的可选版本
 * @throws 已知模型版本或其他映射字段冲突时抛出 PrintSurfaceError
 */
export function resolveRestoredPrintMapping(saved: DesignPrintMapping, current: DesignPrintMapping, modelRevision?: string): DesignPrintMapping {
  assertDesignMappingMatches(saved, { ...current, modelRevision })
  return { ...saved, domain: { ...saved.domain } }
}
