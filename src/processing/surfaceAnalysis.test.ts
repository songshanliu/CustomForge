import { describe, expect, it } from 'vitest'
import { analyzeSurfaceSnapshots } from './surfaceAnalysis'
import type { SurfaceAnalysisOptions, SurfaceGeometrySnapshot } from './types'

const options: SurfaceAnalysisOptions = {
  maxAreas: 4,
  adjacentAngleDegrees: 35,
  normalDeviationDegrees: 50,
  minimumAreaRatio: 0.001,
}

function snapshot(
  positions: number[],
  indices: number[],
  materialIndices?: number[],
): SurfaceGeometrySnapshot {
  return {
    meshId: 'mesh-0',
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    materialIndices: Int32Array.from(
      materialIndices ?? new Array(indices.length / 3).fill(0),
    ),
  }
}

describe('analyzeSurfaceSnapshots', () => {
  it('merges adjacent coplanar triangles into one candidate', () => {
    const result = analyzeSurfaceSnapshots([
      snapshot(
        [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
        [0, 1, 2, 0, 2, 3],
      ),
    ], options)

    expect(result.candidates).toHaveLength(1)
    expect(Array.from(result.candidates[0].triangleIndices)).toEqual([0, 1])
    expect(result.candidates[0].normalConsistency).toBeCloseTo(1)
  })

  it('keeps material groups as separate design candidates', () => {
    const result = analyzeSurfaceSnapshots([
      snapshot(
        [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
        [0, 1, 2, 0, 2, 3],
        [0, 1],
      ),
    ], options)

    expect(result.candidates).toHaveLength(2)
  })

  it('returns stable candidate ids and ranking', () => {
    const input = snapshot(
      [
        0, 0, 0, 2, 0, 0, 0, 2, 0,
        4, 0, 0, 5, 0, 0, 4, 1, 0,
      ],
      [0, 1, 2, 3, 4, 5],
    )

    const first = analyzeSurfaceSnapshots([input], options)
    const second = analyzeSurfaceSnapshots([input], options)

    expect(first.candidates.map(({ id }) => id)).toEqual(
      second.candidates.map(({ id }) => id),
    )
    expect(first.candidates[0].areaRatio).toBeGreaterThan(
      first.candidates[1].areaRatio,
    )
  })
})
