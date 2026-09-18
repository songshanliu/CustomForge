import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'
import { extractUvLayout } from './uvLayout'

function createQuadGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      3,
    ),
  )
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  )
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

describe('extractUvLayout', () => {
  it('extracts indexed UV triangles', () => {
    const mesh = new Mesh(createQuadGeometry(), new MeshStandardMaterial())

    expect(Array.from(extractUvLayout(mesh).triangleCoordinates)).toEqual([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ])
  })

  it('keeps only triangles assigned to the first material slot', () => {
    const geometry = createQuadGeometry()
    geometry.addGroup(0, 3, 1)
    geometry.addGroup(3, 3, 0)
    const mesh = new Mesh(geometry, [
      new MeshStandardMaterial(),
      new MeshStandardMaterial(),
    ])

    expect(Array.from(extractUvLayout(mesh).triangleCoordinates)).toEqual([
      0, 0, 1, 1, 0, 1,
    ])
  })

  it('rejects a customizable mesh without UV coordinates', () => {
    const geometry = createQuadGeometry()
    geometry.deleteAttribute('uv')
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    mesh.name = 'PrintArea'

    expect(() => extractUvLayout(mesh)).toThrow(
      'Customizable mesh does not contain UV coordinates: PrintArea',
    )
  })
})
