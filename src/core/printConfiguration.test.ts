import { describe, expect, it } from 'vitest'
import { resolvePrintConfiguration, resolvePrintSurface } from './printConfiguration'
import { readUvDomain, readUvChannel, resolveRestoredPrintMapping, transformUvLayout, validateCanvasSize } from './printMapping'
import type { CustomizerOptions, DesignDocument, DesignPrintMapping, UvDomain } from './types'
import type { UvLayout } from './uv'

const unit: UvDomain = { minU: 0, minV: 0, maxU: 1, maxV: 1 }
const negative: UvDomain = { minU: -2, minV: 0.25, maxU: -1, maxV: 1.25 }
const metadata = {
  customforge: {
    version: 1,
    canvas: { width: 1200, height: 600 },
    printSurface: { uvChannel: 1, textureFlipY: true, uvMapping: { mode: 'fit-bounds' } },
  },
}

function quad(domain: UvDomain): UvLayout {
  const { minU: a, minV: b, maxU: c, maxV: d } = domain
  return {
    triangleCoordinates: new Float32Array([a, b, c, b, c, d, a, b, c, d, a, d]),
    boundaryCoordinates: new Float32Array([a, b, c, b, c, b, c, d, c, d, a, d, a, d, a, b]),
  }
}

function resolve(options: Pick<CustomizerOptions, 'product' | 'editorWidth' | 'editorHeight' | 'readModelMetadata'> = {}, layout = quad(unit), nodeData: unknown = {}, design?: DesignDocument) {
  return resolvePrintSurface(resolvePrintConfiguration(options, nodeData, design), layout)
}

describe('shared print mapping', () => {
  it('T01/T02 keeps identity and original margins unless fit is explicitly selected', () => {
    const margins = { minU: 0.125, minV: 0.25, maxU: 0.875, maxV: 0.75 }
    const layout = quad(margins)
    const original = resolve({}, layout)
    expect(original.layout).toEqual(layout)
    expect(original.info.mapping.domain).toEqual(unit)
    expect(original.info.printableBounds).toEqual({ left: 128, top: 128, width: 768, height: 256 })
    expect(original.info.usesMappingDocument).toBe(false)
    const fit = resolve({ product: { uvMapping: { mode: 'fit-bounds' } } }, layout)
    expect(fit.info.mapping.domain).toEqual(margins)
    expect(fit.info.printableBounds).toEqual({ left: 0, top: 0, width: 1024, height: 512 })
    expect(fit.info.usesMappingDocument).toBe(true)
  })

  it('T03/T04 uses the measured negative domain only when opted in', () => {
    const snowman = { minU: -1.0554617643356323, minV: 0.052602171897888184, maxU: -0.05953139066696167, maxV: 1.045965552330017 }
    const layout = quad(snowman)
    const before = Array.from(layout.triangleCoordinates)
    const original = resolve({}, layout)
    expect(original.info.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining(['UV_OUTSIDE_DESIGN_DOMAIN', 'PRINT_UV_DOMAIN_DEGENERATE']))
    const fit = resolve({ product: { uvMapping: { mode: 'fit-bounds' } } }, layout)
    expect(Array.from(fit.layout.triangleCoordinates)).toEqual(Array.from(quad(unit).triangleCoordinates))
    expect(fit.info.mapping.domain).toEqual(snowman)
    expect(fit.info.diagnostics.some((entry) => entry.code === 'UV_OUTSIDE_DESIGN_DOMAIN')).toBe(false)
    expect(Array.from(layout.triangleCoordinates)).toEqual(before)
  })

  it('T05/T06 maps known extrema and midpoint while preserving explicit margins', () => {
    const layout: UvLayout = { triangleCoordinates: new Float32Array([-2, 0.25, -1.5, 0.75, -1, 1.25]), boundaryCoordinates: new Float32Array() }
    expect(Array.from(transformUvLayout(layout, negative).triangleCoordinates)).toEqual([0, 0, 0.5, 0.5, 1, 1])
    const result = resolve({ product: { uvMapping: { mode: 'domain', domain: { minU: -2.5, minV: 0, maxU: -0.5, maxV: 2 } } } }, quad(negative))
    expect(result.info.printableBounds).toEqual({ left: 256, top: 64, width: 512, height: 256 })
  })

  it('T07 applies vertical direction once in canvas coordinates', () => {
    const layout = quad({ minU: 0.125, minV: 0.125, maxU: 0.5, maxV: 0.375 })
    expect(resolve({}, layout).info.printableBounds.top).toBe(64)
    const flipped = resolve({ product: { textureFlipY: true } }, layout)
    expect(flipped.info.printableBounds.top).toBe(320)
    expect(flipped.info.mapping.textureFlipY).toBe(true)
    expect(flipped.layout).toEqual(layout)
  })

  it('T09/T10 shares one affine map across disjoint and overlapping islands', () => {
    const coordinates = [-2, 0, -1.75, 0, -2, 0.25, -1.25, 0.75, -1, 0.75, -1, 1]
    const layout: UvLayout = { triangleCoordinates: new Float32Array([...coordinates, ...coordinates.slice(0, 6)]), boundaryCoordinates: new Float32Array() }
    const result = resolve({ product: { uvMapping: { mode: 'fit-bounds' } } }, layout)
    expect(Array.from(result.layout.triangleCoordinates)).toEqual([0, 0, 0.25, 0, 0, 0.25, 0.75, 0.75, 1, 0.75, 1, 1, 0, 0, 0.25, 0, 0, 0.25])
    expect(result.info.triangleCount).toBe(3)
  })

  it('T12 rejects invalid or degenerate new domains and retains an explicit legacy diagnostic', () => {
    const flat = quad({ minU: 0.5, minV: 0, maxU: 0.5, maxV: 1 })
    expect(() => resolve({ product: { uvMapping: { mode: 'fit-bounds' } } }, flat)).toThrow('non-degenerate')
    expect(resolve({}, flat).info.diagnostics.some((entry) => entry.code === 'PRINT_UV_DOMAIN_DEGENERATE')).toBe(true)
    expect(() => resolve({}, { triangleCoordinates: new Float32Array([0, 0, Infinity, 0, 1, 1]), boundaryCoordinates: new Float32Array() })).toThrow('non-finite')
    for (const domain of [{ ...unit, minU: NaN }, { ...unit, maxV: 0 }, { ...unit, maxU: 1e-10 }]) expect(() => readUvDomain(domain)).toThrow()
    expect(() => transformUvLayout(quad({ minU: -3e38, minV: 0, maxU: 3e38, maxV: 1 }), { ...unit, maxU: 1e-7 })).toThrow('finite range')
  })

  it('distinguishes a valid domain outside the mesh from a printable full canvas', () => {
    const result = resolve({ product: { uvMapping: { mode: 'domain', domain: unit } } }, quad(negative))
    expect(result.info.printableBounds.width).toBe(0)
    expect(result.info.diagnostics.some((entry) => entry.code === 'UV_OUTSIDE_DESIGN_DOMAIN')).toBe(true)
  })
})

describe('canvas metadata and document precedence', () => {
  it('T18/T19 preserves restored revisions without trusting an earlier document as model identity', () => {
    const current: DesignPrintMapping = { version: 1, surfaceMesh: 'PrintArea', uvChannel: 0, domain: unit, textureFlipY: false, modelRevision: 'old-unverified' }
    const saved: DesignPrintMapping = { ...current, modelRevision: 'document-b' }
    const restored = resolveRestoredPrintMapping(saved, current)
    expect(restored).toEqual(saved)
    expect(restored).not.toBe(saved)
    expect(restored.domain).not.toBe(saved.domain)
    expect(() => resolveRestoredPrintMapping(saved, current, 'actual-a')).toThrow('mapping does not match')
    expect(resolveRestoredPrintMapping(saved, current, 'document-b')).toEqual(saved)
    const withoutRevision = { ...saved }
    delete withoutRevision.modelRevision
    expect(resolveRestoredPrintMapping(withoutRevision, current, 'actual-a')).toEqual(withoutRevision)
  })

  it('T13/T14 resolves formal node metadata and lets an explicit pair and mapping override it', () => {
    const automatic = resolvePrintConfiguration({ readModelMetadata: true }, metadata)
    expect(automatic.canvas).toEqual({ width: 1200, height: 600 })
    expect(automatic.product).toMatchObject({ uvChannel: 1, textureFlipY: true, uvMapping: { mode: 'fit-bounds' } })
    expect(automatic.sources.canvas).toBe('model-metadata')
    const explicit = resolvePrintConfiguration({ readModelMetadata: true, editorWidth: 800, editorHeight: 400, product: { uvChannel: 0, textureFlipY: false, uvMapping: { mode: 'original' } } }, metadata)
    expect(explicit.canvas).toEqual({ width: 800, height: 400 })
    expect(explicit.sources).toEqual({ canvas: 'configuration', uvChannel: 'configuration', uvMapping: 'configuration', textureFlipY: 'configuration' })
    expect(explicit.product.uvMapping).toEqual({ mode: 'original' })
  })

  it('T15 keeps metadata opt-in and diagnoses missing sizes without reading root examples', () => {
    expect(resolvePrintConfiguration({}, metadata).canvas).toEqual({ width: 1024, height: 512 })
    const missing = resolvePrintConfiguration({ readModelMetadata: true }, { exampleCanvas: { width: 4096, height: 4096 } })
    expect(missing.canvas).toEqual({ width: 1024, height: 512 })
    expect(missing.diagnostics.some((entry) => entry.code === 'CANVAS_METADATA_MISSING')).toBe(true)
    expect(resolvePrintConfiguration({ readModelMetadata: true }, { customforgeGuide: { canvas: { width: 800, height: 600 } } }).sources.canvas).toBe('legacy-metadata')
    expect(resolvePrintConfiguration({ readModelMetadata: true }, { ...metadata, canvasWidth: 800, canvasHeight: 600 }).canvas.width).toBe(1200)
  })

  it('T16 validates pairs, integers, side limits, device limits and allocation area', () => {
    expect(resolvePrintConfiguration({ editorWidth: 800 }, {}).canvas).toEqual({ width: 800, height: 512 })
    expect(() => resolvePrintConfiguration({ readModelMetadata: true, editorWidth: 800 }, metadata)).toThrow('together')
    for (const [width, height] of [[0, 512], [1.2, 512], [8193, 1], [8192, 8192], [NaN, 1], [Infinity, 1]]) expect(() => validateCanvasSize(width, height)).toThrow()
    expect(() => validateCanvasSize(4096, 512, 2048)).toThrow('2048px')
    expect(() => resolvePrintConfiguration({ readModelMetadata: true }, { customforge: { version: 9 } })).toThrow('version must be 1')
    expect(() => resolvePrintConfiguration({ readModelMetadata: true }, { canvasWidth: 800 })).toThrow('positive integers')
    expect(() => readUvChannel(4)).toThrow()
    expect(() => resolvePrintConfiguration({ readModelMetadata: true }, { customforgeGuide: { canvas: { width: 800 } }, canvasHeight: 600 })).toThrow('positive integers')
  })

  it('T20 retains the instance canvas when the next product has no size declaration', () => {
    const canvas = { width: 800, height: 400 }
    const next = resolvePrintConfiguration({}, {}, undefined, 8192, canvas)
    expect(next.canvas).toEqual(canvas)
    expect(next.sources.canvas).toBe('instance')
    expect(resolvePrintConfiguration({ editorWidth: 800 }, {}, undefined, 8192, { width: 800, height: 200 }).canvas).toEqual({ width: 800, height: 200 })
    const declared = resolvePrintConfiguration({ readModelMetadata: true }, metadata, undefined, 8192, canvas)
    expect(declared.canvas).toEqual({ width: 1200, height: 600 })
    expect(declared.sources.canvas).toBe('model-metadata')
  })

  it('T17 restores Schema 1 using legacy UV0, saved size and the outer direction', () => {
    const design: DesignDocument = { version: 1, canvas: { width: 800, height: 400 }, objects: [] }
    const restored = resolve({ readModelMetadata: true, product: { textureFlipY: true } }, quad(unit), metadata, design)
    expect(restored.info.canvas).toEqual(design.canvas)
    expect(restored.info.mapping).toMatchObject({ domain: unit, uvChannel: 0, textureFlipY: true })
    expect(restored.info.usesMappingDocument).toBe(false)
    expect(() => resolve({ product: { uvMapping: { mode: 'fit-bounds' } } }, quad(unit), {}, design)).toThrow('Schema 1')
  })

  it('T18/T19 keeps saved numerical mapping despite newer metadata and rejects explicit conflicts', () => {
    const mapping: DesignPrintMapping = { version: 1, surfaceMesh: 'PrintArea', uvChannel: 1, domain: negative, textureFlipY: true, modelRevision: 'hash-a' }
    const design: DesignDocument = { version: 2, canvas: { width: 800, height: 400 }, objects: [], printMapping: mapping }
    const restored = resolve({ readModelMetadata: true, product: { modelRevision: 'hash-a' } }, quad(negative), metadata, design)
    expect(restored.info.mapping).toEqual(mapping)
    expect(restored.info.modelRevisionVerified).toBe(true)
    expect(restored.info.sources.canvas).toBe('design')
    expect(resolve({}, quad(negative), {}, design).info.modelRevisionVerified).toBe(false)
    for (const options of [
      { editorWidth: 1024 },
      { product: { uvChannel: 0 as const } },
      { product: { surfaceMesh: 'Other' } },
      { product: { textureFlipY: false } },
      { product: { modelRevision: 'hash-b' } },
      { product: { uvMapping: { mode: 'domain' as const, domain: unit } } },
    ]) expect(() => resolve(options, quad(negative), {}, design)).toThrow()
  })
})
