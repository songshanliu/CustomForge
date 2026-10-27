import { normalizeProductConfiguration } from './config'
import { PrintSurfaceError } from './printErrors'
import { assertDesignMappingMatches, equalUvDomains, getRawUvBounds, readUvChannel, readUvDomain, readUvMapping, transformUvLayout, validateCanvasSize } from './printMapping'
import type { CustomizerOptions, DesignCanvas, DesignDocument, DesignPrintMapping, PrintDiagnostic, PrintSurfaceInfo, PrintUvMapping, ResolvedProductConfiguration } from './types'
import type { UvLayout } from './uv'
import { calculateUvCanvasBounds } from '../editor/uvBounds'

/** 创建画布与解析实际 UV 前确定的配置，不包含原始几何资源 */
export interface PrintConfiguration {
  /** 补全后的产品配置 */
  product: ResolvedProductConfiguration
  /** 经资源限制校验的逻辑尺寸 */
  canvas: DesignCanvas
  /** 逐项配置来源 */
  sources: PrintSurfaceInfo['sources']
  /** 目前已知诊断 */
  diagnostics: PrintDiagnostic[]
  /** 是否必须持久化映射 */
  usesMappingDocument: boolean
  /** 恢复文档声明的映射 */
  savedMapping?: DesignPrintMapping
  /** 需要与保存域对照的调用配置 */
  explicitMapping?: PrintUvMapping
  /** 保存版本是否与外层提供的内容版本匹配 */
  modelRevisionVerified: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

function diagnostic(code: PrintDiagnostic['code'], message: string): PrintDiagnostic {
  return { code, severity: 'warning', message }
}

/**
 * 按恢复文档、显式配置、主动元数据及旧默认值解析尺寸与映射来源
 *
 * @param fallbackCanvas 产品切换时沿用的逻辑尺寸，仅在没有其他尺寸来源时使用
 */
export function resolvePrintConfiguration(
  options: Pick<CustomizerOptions, 'product' | 'editorWidth' | 'editorHeight' | 'readModelMetadata'>,
  nodeData: unknown,
  design?: DesignDocument,
  deviceLimit?: number,
  fallbackCanvas?: DesignCanvas,
): PrintConfiguration {
  if (options.readModelMetadata !== undefined && typeof options.readModelMetadata !== 'boolean') {
    throw new TypeError('readModelMetadata must be a boolean')
  }
  const requested = options.product ?? {}
  const diagnostics: PrintDiagnostic[] = []
  const data = record(nodeData) ?? {}
  const hasMetadata = data.customforge !== undefined || data.customforgeGuide !== undefined || data.canvasWidth !== undefined || data.canvasHeight !== undefined
  let metadata: Record<string, unknown> = {}
  let metadataCanvas: DesignCanvas | undefined
  let canvasSource: PrintSurfaceInfo['sources']['canvas'] = fallbackCanvas ? 'instance' : 'default'
  if (options.readModelMetadata && !design) {
    try {
      if (data.customforge !== undefined) {
        const formal = record(data.customforge)
        if (!formal || formal.version !== 1) throw new TypeError('extras.customforge.version must be 1')
        if (formal.canvas !== undefined) {
          const canvas = record(formal.canvas)
          metadataCanvas = validateCanvasSize(canvas?.width, canvas?.height, deviceLimit)
          canvasSource = 'model-metadata'
        }
        if (formal.printSurface !== undefined) {
          const surface = record(formal.printSurface)
          if (!surface) throw new TypeError('extras.customforge.printSurface must be an object')
          metadata = surface
        }
      }
      if (!metadataCanvas) {
        const guideCanvas = record(record(data.customforgeGuide)?.canvas)
        if (guideCanvas || data.canvasWidth !== undefined || data.canvasHeight !== undefined) {
          metadataCanvas = guideCanvas
            ? validateCanvasSize(guideCanvas.width, guideCanvas.height, deviceLimit)
            : validateCanvasSize(data.canvasWidth, data.canvasHeight, deviceLimit)
          canvasSource = 'legacy-metadata'
        }
      }
      if (metadata.uvChannel !== undefined) readUvChannel(metadata.uvChannel)
      if (metadata.uvMapping !== undefined) readUvMapping(metadata.uvMapping)
      if (metadata.textureFlipY !== undefined && typeof metadata.textureFlipY !== 'boolean') throw new TypeError('Metadata textureFlipY must be a boolean')
    } catch (error) {
      if (error instanceof PrintSurfaceError) throw error
      throw new PrintSurfaceError('MODEL_METADATA_INVALID', error instanceof Error ? error.message : 'Invalid print metadata')
    }
    if (!metadataCanvas) diagnostics.push(diagnostic('CANVAS_METADATA_MISSING', 'The selected print node has no explicit canvas size; using configuration or legacy defaults'))
  } else if (hasMetadata || (options.readModelMetadata && design)) {
    diagnostics.push({ code: 'MODEL_METADATA_IGNORED', severity: 'info', message: design ? 'Saved design settings take precedence over current model metadata' : 'Model metadata is disabled; legacy configuration remains in use' })
  }
  const hasWidth = options.editorWidth !== undefined, hasHeight = options.editorHeight !== undefined
  if (options.readModelMetadata && hasWidth !== hasHeight) {
    throw new PrintSurfaceError('CANVAS_SIZE_INVALID', 'Metadata mode requires editorWidth and editorHeight together')
  }
  let canvas: DesignCanvas
  if (design) {
    if ((hasWidth && options.editorWidth !== design.canvas.width) || (hasHeight && options.editorHeight !== design.canvas.height)) throw new PrintSurfaceError('CANVAS_SIZE_MISMATCH', 'Explicit canvas size conflicts with initialDesign')
    canvas = validateCanvasSize(design.canvas.width, design.canvas.height, deviceLimit)
    canvasSource = 'design'
  } else if (hasWidth || hasHeight) {
    canvas = validateCanvasSize(options.editorWidth ?? fallbackCanvas?.width ?? 1024, options.editorHeight ?? fallbackCanvas?.height ?? 512, deviceLimit)
    canvasSource = 'configuration'
    if (metadataCanvas && (canvas.width !== metadataCanvas.width || canvas.height !== metadataCanvas.height)) diagnostics.push({ code: 'MODEL_METADATA_IGNORED', severity: 'info', message: 'Explicit canvas size overrides the model canvas metadata' })
  } else {
    canvas = metadataCanvas ?? validateCanvasSize(fallbackCanvas?.width ?? 1024, fallbackCanvas?.height ?? 512, deviceLimit)
  }
  const sources: PrintSurfaceInfo['sources'] = {
    canvas: canvasSource,
    uvChannel: requested.uvChannel !== undefined ? 'configuration' : metadata.uvChannel !== undefined ? 'model-metadata' : 'default',
    uvMapping: requested.uvMapping !== undefined ? 'configuration' : metadata.uvMapping !== undefined ? 'model-metadata' : 'default',
    textureFlipY: requested.textureFlipY !== undefined ? 'configuration' : metadata.textureFlipY !== undefined ? 'model-metadata' : 'default',
  }
  let product = normalizeProductConfiguration({
    ...requested,
    uvChannel: requested.uvChannel ?? (metadata.uvChannel === undefined ? 0 : readUvChannel(metadata.uvChannel)),
    uvMapping: requested.uvMapping ?? (metadata.uvMapping === undefined ? { mode: 'original' } : readUvMapping(metadata.uvMapping)),
    textureFlipY: requested.textureFlipY ?? (metadata.textureFlipY as boolean | undefined) ?? false,
  })
  let savedMapping: DesignPrintMapping | undefined
  let usesMappingDocument = sources.uvMapping !== 'default' || product.uvChannel !== 0 || sources.textureFlipY === 'model-metadata' || requested.modelRevision !== undefined
  let modelRevisionVerified = false
  if (design?.version === 1) {
    if (product.uvChannel !== 0 || product.uvMapping.mode !== 'original') throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Schema 1 requires UV0 and original mapping; migrate explicitly before enabling a new mapping')
    sources.uvChannel = 'design'; sources.uvMapping = 'design'
    usesMappingDocument = false
  }
  if (design?.version === 2) {
    savedMapping = design.printMapping
    if ((requested.surfaceMesh !== undefined && product.surfaceMesh !== savedMapping.surfaceMesh) || (requested.uvChannel !== undefined && requested.uvChannel !== savedMapping.uvChannel) || (requested.textureFlipY !== undefined && requested.textureFlipY !== savedMapping.textureFlipY) || (requested.modelRevision !== undefined && savedMapping.modelRevision !== undefined && requested.modelRevision !== savedMapping.modelRevision)) {
      throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Explicit product configuration conflicts with initialDesign mapping')
    }
    modelRevisionVerified = savedMapping.modelRevision !== undefined && requested.modelRevision === savedMapping.modelRevision
    product = { ...product, surfaceMesh: savedMapping.surfaceMesh, uvChannel: savedMapping.uvChannel, textureFlipY: savedMapping.textureFlipY, uvMapping: { mode: 'domain', domain: { ...savedMapping.domain } } }
    sources.uvChannel = 'design'; sources.uvMapping = 'design'; sources.textureFlipY = 'design'
    usesMappingDocument = true
  }
  if (!modelRevisionVerified) diagnostics.push(diagnostic('MODEL_REVISION_UNVERIFIED', 'Model content identity is not verified; an unchanged URL does not prove identical model content'))
  return { product, canvas, sources, diagnostics, usesMappingDocument, savedMapping, explicitMapping: design?.version === 2 ? requested.uvMapping : undefined, modelRevisionVerified }
}

/** 由原始布局生成唯一的数值映射、二维布局和诊断，三维只消费同一 mapping */
export function resolvePrintSurface(configuration: PrintConfiguration, rawLayout: UvLayout): { info: PrintSurfaceInfo; layout: UvLayout } {
  const { product, canvas } = configuration
  const rawBounds = getRawUvBounds(rawLayout)
  const unit = { minU: 0, minV: 0, maxU: 1, maxV: 1 }
  const chooseDomain = (mapping: PrintUvMapping) => mapping.mode === 'original' ? unit : readUvDomain(mapping.mode === 'fit-bounds' ? rawBounds : mapping.domain)
  const domain = chooseDomain(product.uvMapping)
  const diagnostics = [...configuration.diagnostics]
  if (product.uvMapping.mode !== 'original') readUvDomain(rawBounds)
  if (configuration.explicitMapping && !equalUvDomains(chooseDomain(configuration.explicitMapping), domain)) throw new PrintSurfaceError('DESIGN_MAPPING_MISMATCH', 'Explicit UV domain conflicts with the saved numerical mapping')
  if (rawBounds.minU < domain.minU - 1e-7 || rawBounds.minV < domain.minV - 1e-7 || rawBounds.maxU > domain.maxU + 1e-7 || rawBounds.maxV > domain.maxV + 1e-7) diagnostics.push(diagnostic('UV_OUTSIDE_DESIGN_DOMAIN', 'Print UV extends outside the design domain; sampling outside that domain clamps to its edges'))
  const legacy = product.uvMapping.mode === 'original'
  if (legacy && (rawBounds.maxU - rawBounds.minU <= 1e-8 || rawBounds.maxV - rawBounds.minV <= 1e-8 || rawBounds.maxU <= 0 || rawBounds.minU >= 1 || rawBounds.maxV <= 0 || rawBounds.minV >= 1)) diagnostics.push(diagnostic('PRINT_UV_DOMAIN_DEGENERATE', 'Original mapping has a degenerate visible print extent; legacy full-canvas bounds fallback remains enabled'))
  const mapping: DesignPrintMapping = {
    version: 1, surfaceMesh: product.surfaceMesh, uvChannel: product.uvChannel,
    domain: { ...domain }, textureFlipY: product.textureFlipY,
    ...((product.modelRevision ?? configuration.savedMapping?.modelRevision) === undefined ? {} : { modelRevision: product.modelRevision ?? configuration.savedMapping?.modelRevision }),
  }
  if (configuration.savedMapping) assertDesignMappingMatches(configuration.savedMapping, mapping)
  const layout = transformUvLayout(rawLayout, domain)
  return {
    layout,
    info: {
      surfaceMesh: product.surfaceMesh, materialIndex: 0, uvChannel: product.uvChannel,
      rawBounds, triangleCount: rawLayout.triangleCoordinates.length / 6,
      mapping, mappingMode: product.uvMapping.mode, sources: { ...configuration.sources }, canvas: { ...canvas },
      printableBounds: calculateUvCanvasBounds(layout, product.textureFlipY, canvas.width, canvas.height, legacy),
      modelRevisionVerified: configuration.modelRevisionVerified, usesMappingDocument: configuration.usesMappingDocument, diagnostics,
    },
  }
}
