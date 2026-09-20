import { describe, expect, it } from 'vitest'
import type { UvLayout } from '../core/uv'
import { calculateUvCanvasBounds } from './uvBounds'

function layout(triangleCoordinates: number[]): UvLayout {
  return {
    triangleCoordinates: new Float32Array(triangleCoordinates),
    boundaryCoordinates: new Float32Array(),
  }
}

describe('UV canvas bounds', () => {
  it('maps the UV range to logical canvas coordinates', () => {
    expect(
      calculateUvCanvasBounds(
        layout([0.25, 0.125, 0.75, 0.125, 0.25, 0.625]),
        false,
        1024,
        512,
      ),
    ).toEqual({ left: 256, top: 64, width: 512, height: 256 })
  })

  it('uses the displayed vertical direction when the texture is flipped', () => {
    expect(
      calculateUvCanvasBounds(
        layout([0.25, 0.125, 0.75, 0.125, 0.25, 0.625]),
        true,
        1024,
        512,
      ),
    ).toEqual({ left: 256, top: 192, width: 512, height: 256 })
  })

  it('clamps UV coordinates to the texture and falls back for empty layouts', () => {
    expect(
      calculateUvCanvasBounds(
        layout([-0.25, -0.5, 1.25, -0.5, -0.25, 1.5]),
        false,
        1024,
        512,
      ),
    ).toEqual({ left: 0, top: 0, width: 1024, height: 512 })
    expect(
      calculateUvCanvasBounds(layout([]), false, 1024, 512),
    ).toEqual({ left: 0, top: 0, width: 1024, height: 512 })
  })
})
