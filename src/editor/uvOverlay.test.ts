import { describe, expect, it, vi } from 'vitest'
import type { UvLayout } from '../core/uv'
import { drawUvOverlay } from './uvOverlay'

function createContextRecorder(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

function createHighDensityLayout(triangleCount: number): UvLayout {
  const triangleCoordinates = new Float32Array(triangleCount * 6)
  for (let index = 0; index < triangleCoordinates.length; index += 6) {
    triangleCoordinates.set([0, 0, 1, 0, 0, 1], index)
  }
  return {
    triangleCoordinates,
    boundaryCoordinates: new Float32Array([
      0, 0, 1, 0,
      1, 0, 1, 1,
      1, 1, 0, 1,
      0, 1, 0, 0,
    ]),
  }
}

describe('UV overlay drawing', () => {
  it('fills a high-density layout without closing every triangle path', () => {
    const triangleCount = 47_432
    const context = createContextRecorder()

    drawUvOverlay(
      context,
      createHighDensityLayout(triangleCount),
      false,
      1024,
      512,
      { fill: '#268a4b', boundary: '#dc2626' },
    )

    expect(context.closePath).not.toHaveBeenCalled()
    expect(context.moveTo).toHaveBeenCalledTimes(triangleCount + 4)
    expect(context.lineTo).toHaveBeenCalledTimes(triangleCount * 2 + 4)
    expect(context.fill).toHaveBeenCalledOnce()
    expect(context.stroke).toHaveBeenCalledOnce()
  })

  it('uses the configured texture direction for triangle and boundary paths', () => {
    const layout: UvLayout = {
      triangleCoordinates: new Float32Array([
        0.25, 0.125,
        0.75, 0.125,
        0.25, 0.625,
      ]),
      boundaryCoordinates: new Float32Array([0.25, 0.125, 0.75, 0.125]),
    }
    const normal = createContextRecorder()
    const flipped = createContextRecorder()

    drawUvOverlay(normal, layout, false, 100, 100, {
      fill: '#268a4b',
      boundary: '#dc2626',
    })
    drawUvOverlay(flipped, layout, true, 100, 100, {
      fill: '#268a4b',
      boundary: '#dc2626',
    })

    expect(normal.moveTo).toHaveBeenNthCalledWith(1, 25, 12.5)
    expect(flipped.moveTo).toHaveBeenNthCalledWith(1, 25, 87.5)
    expect(normal.moveTo).toHaveBeenNthCalledWith(2, 25, 12.5)
    expect(flipped.moveTo).toHaveBeenNthCalledWith(2, 25, 87.5)
  })
})
