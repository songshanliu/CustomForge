import { Vector2 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextureBridge } from './TextureBridge'
import type { DesignEditor } from '../editor/DesignEditor'
import type { ProductViewer } from '../viewer/ProductViewer'
import type { DesignPrintMapping } from '../core/types'

afterEach(() => vi.unstubAllGlobals())

describe('design texture mapping', () => {
  it.each([false, true])('T06/T07/T20 shares numerical coordinates and resets every matrix field (flipY=%s)', (textureFlipY) => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const stop = vi.fn()
    const editor = { textureCanvas: {}, onRender: () => stop } as unknown as DesignEditor
    const viewer = { setTexture: vi.fn() } as unknown as ProductViewer
    const mapping: DesignPrintMapping = { version: 1, surfaceMesh: 'PrintArea', uvChannel: 1, domain: { minU: -2, minV: 0.25, maxU: -1, maxV: 1.25 }, textureFlipY }
    const bridge = new TextureBridge(editor, viewer, mapping)
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const point = new Vector2(-2 + ratio, 0.25 + ratio).applyMatrix3(bridge.texture.matrix)
      expect(point.x).toBeCloseTo(ratio)
      expect(point.y).toBeCloseTo(ratio)
    }
    expect(bridge.texture.flipY).toBe(textureFlipY)
    bridge.setMapping({ ...mapping, uvChannel: 0, textureFlipY: false, domain: { minU: 0, minV: 0, maxU: 1, maxV: 1 } })
    expect(bridge.texture.repeat.toArray()).toEqual([1, 1])
    expect(bridge.texture.offset.toArray()).toEqual([-0, -0])
    expect(bridge.texture.center.toArray()).toEqual([0, 0])
    expect(bridge.texture.rotation).toBe(0)
    expect(bridge.texture.channel).toBe(0)
    expect(bridge.texture.flipY).toBe(false)
    expect(new Vector2(0.3, 0.7).applyMatrix3(bridge.texture.matrix).toArray()).toEqual([0.3, 0.7])
    bridge.destroy()
    expect(stop).toHaveBeenCalledOnce()
  })
})
