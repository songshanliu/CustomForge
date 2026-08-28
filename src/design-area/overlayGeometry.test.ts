import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'
import type { SurfaceCandidate } from '../processing/types'
import { createCandidateOverlayGeometry } from './overlayGeometry'

function candidate(triangles: number[]): SurfaceCandidate {
  return {
    id: 'surface-0',
    meshId: 'scene/mesh[0]',
    triangleIndices: Uint32Array.from(triangles),
    score: 1,
    areaRatio: 1,
    normalConsistency: 1,
    compactness: 1,
    projection: {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      tangentX: 1,
      tangentY: 0,
      tangentZ: 0,
      normalX: 0,
      normalY: 0,
      normalZ: 1,
      width: 1,
      height: 1,
      depth: 0.1,
    },
  }
}

describe('createCandidateOverlayGeometry', () => {
  it('copies only selected triangles and compacts shared vertices', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([
        0, 0, 0,
        1, 0, 0,
        1, 1, 0,
        0, 1, 0,
      ], 3),
    )
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    const source = new Mesh(geometry, new MeshBasicMaterial())

    const overlay = createCandidateOverlayGeometry(source, candidate([1]))

    expect(overlay.index?.count).toBe(3)
    expect(overlay.getAttribute('position').count).toBe(3)
    expect(overlay.getAttribute('normal').count).toBe(3)
    expect(overlay.getAttribute('uv')).toBeUndefined()
  })

  it('rejects source triangle indexes outside the geometry', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    const source = new Mesh(geometry, new MeshBasicMaterial())

    expect(() =>
      createCandidateOverlayGeometry(source, candidate([2])),
    ).toThrow('Design area contains an invalid source triangle')
  })
})

