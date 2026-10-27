import { describe, expect, it } from 'vitest'
import { calculateEditorView, normalizeEditorViewOptions } from './editorView'
import { calculateUvViewBounds } from './uvBounds'
import type { CanvasBounds, EditorViewOptions } from '../core/types'

const design = { width: 1024, height: 512 }
const defaults = normalizeEditorViewOptions()
const bounds = { left: 128, top: 64, width: 512, height: 256 }

describe('editor viewport contract', () => {
  it('V02 keeps negative offsets and matches the specification example', () => {
    const state = calculateEditorView(design, bounds, { width: 800, height: 500 }, defaults)
    expect(state.zoom).toBeCloseTo(1.3392857143)
    expect(state.offsetX).toBeCloseTo(-114.2857143)
    expect(state.offsetY).toBeCloseTo(-7.1428571)
    expect(state.ready).toBe(true)
  })

  it.each([
    { left: 700, top: 300, width: 40, height: 20 },
    { left: 200, top: 100, width: 640, height: 20 },
    { left: 200, top: 100, width: 20, height: 300 },
    { left: 300, top: 100, width: 200, height: 200 },
  ])('V01/V03/V04 fits and centers $width × $height without distortion', (area) => {
    for (const viewport of [{ width: 800, height: 500 }, { width: 300, height: 700 }, { width: 1600, height: 800 }]) {
      const state = calculateEditorView(design, area, viewport, defaults)
      expect(state.offsetX + state.zoom * (area.left + area.width / 2)).toBeCloseTo(viewport.width / 2)
      expect(state.offsetY + state.zoom * (area.top + area.height / 2)).toBeCloseTo(viewport.height / 2)
      expect(state.zoom * area.width * 1.12).toBeLessThanOrEqual(viewport.width - 32 + 1e-8)
      expect(state.zoom * area.height * 1.12).toBeLessThanOrEqual(viewport.height - 32 + 1e-8)
      if (area.width === 40) expect(state.zoom).toBeGreaterThan(1)
    }
  })

  it('V05 retains the last transform while hidden or smaller than safe padding', () => {
    const previous = calculateEditorView(design, bounds, { width: 800, height: 500 }, defaults)
    for (const viewport of [{ width: 0, height: 0 }, { width: 30, height: 20 }]) {
      const state = calculateEditorView(design, bounds, viewport, defaults, previous)
      expect(state.ready).toBe(false)
      expect([state.zoom, state.offsetX, state.offsetY]).toEqual([previous.zoom, previous.offsetX, previous.offsetY])
    }
  })

  it('V16/V20 exposes invalid-region fallback and limits extreme zoom without forbidding upscale', () => {
    const invalid = calculateEditorView(design, { left: 0, top: 0, width: 0, height: 0 }, { width: 800, height: 500 }, defaults)
    expect(invalid.fallback).toBe('invalid-print-area')
    expect(invalid.ready).toBe(false)
    expect(invalid.printableBounds.width).toBe(0)
    const tiny = calculateEditorView(design, { left: 100, top: 100, width: 1e-10, height: 1e-10 }, { width: 800, height: 500 }, defaults)
    expect(tiny.zoom).toBe(128)
    expect(tiny.zoomLimited).toBe(true)
  })

  it('reproduces the former whole-canvas sizing when requested', () => {
    const state = calculateEditorView(design, bounds, { width: 800, height: 500 }, normalizeEditorViewOptions({ fit: 'canvas', paddingRatio: 0, minPadding: 28, allowUpscale: false }))
    expect(state.zoom).toBe((800 - 56) / 1024)
    expect(state.fallback).toBe('none')
  })

  it.each([
    { fit: 'invalid' }, { paddingRatio: -1 }, { paddingRatio: 0.6 }, { paddingRatio: NaN },
    { minPadding: Infinity }, { minPadding: -1 }, { allowUpscale: 'yes' },
    { fit: null }, { paddingRatio: null }, { minPadding: null }, { allowUpscale: null }, null, [],
  ])('rejects invalid view configuration %j', (options) => {
    expect(() => normalizeEditorViewOptions(options as unknown as EditorViewOptions)).toThrow()
  })

  it('returns independent nested snapshots without mutating any inputs', () => {
    const state = calculateEditorView(design, bounds, { width: 800, height: 500 }, defaults)
    state.printableBounds.left = 0
    state.designCanvas.width = 1
    expect(bounds.left).toBe(128)
    expect(design.width).toBe(1024)
  })
})

function uvBounds(coordinates: number[], flipY = false): CanvasBounds {
  return calculateUvViewBounds({ triangleCoordinates: new Float32Array(coordinates), boundaryCoordinates: new Float32Array() }, flipY, 100, 100)
}

describe('actual printable intersection', () => {
  it('V16 distinguishes degenerate and completely outside triangles from real bounds', () => {
    for (const coordinates of [[], [-2, 0, -1, 0, -1, 1], [0, 0, 0.5, 0.5, 1, 1], [2, 0.5, 0.5, 2, 2, 2]]) {
      expect(uvBounds(coordinates)).toEqual({ left: 0, top: 0, width: 0, height: 0 })
    }
  })
  it('V09 retains multiple islands and the gap between them', () => {
    const actual = uvBounds([0.1, 0.2, 0.3, 0.2, 0.3, 0.4, 0.7, 0.2, 0.9, 0.2, 0.9, 0.4])
    expect(actual.left).toBeCloseTo(10)
    expect(actual.width).toBeCloseTo(80)
    expect(actual.height).toBeCloseTo(20)
  })
  it('clips crossing triangles and applies the resolved flip once', () => {
    const actual = uvBounds([-1, 0.2, 0.5, 0.2, 0.5, 0.8], true)
    expect(actual.left).toBe(0)
    expect(actual.width).toBe(50)
    expect(actual.top).toBeCloseTo(20)
    expect(actual.height).toBeCloseTo(60)
  })
})
