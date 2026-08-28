import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import { createSurfaceGeometrySnapshot } from './geometrySnapshot'

describe('createSurfaceGeometrySnapshot', () => {
  it('copies a non-indexed triangle into transferable arrays', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )

    const snapshot = createSurfaceGeometrySnapshot('scene/mesh[0]', geometry)

    expect(Array.from(snapshot.indices)).toEqual([0, 1, 2])
    expect(snapshot.positions).not.toBe(
      geometry.getAttribute('position').array,
    )
  })

  it('rejects non-finite normals before transferring geometry', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    geometry.setAttribute(
      'normal',
      new Float32BufferAttribute([0, 0, 1, 0, Number.NaN, 1, 0, 0, 1], 3),
    )

    expect(() =>
      createSurfaceGeometrySnapshot('scene/mesh[0]', geometry),
    ).toThrow('Mesh contains invalid normal coordinates')
  })
})
