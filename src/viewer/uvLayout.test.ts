import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'
import { extractUvLayout } from './uvLayout'
import { getRawUvBounds } from '../core/printMapping'

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
    const layout = extractUvLayout(mesh)

    expect(Array.from(layout.triangleCoordinates)).toEqual([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ])
    expect(Array.from(layout.boundaryCoordinates)).toEqual([
      0, 0, 1, 0,
      1, 0, 1, 1,
      1, 1, 0, 1,
      0, 1, 0, 0,
    ])
  })

  it('extracts non-indexed UV triangles', () => {
    const geometry = createQuadGeometry().toNonIndexed()
    const mesh = new Mesh(geometry, new MeshStandardMaterial())

    const layout = extractUvLayout(mesh)

    expect(Array.from(layout.triangleCoordinates)).toEqual([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ])
    expect(Array.from(layout.boundaryCoordinates)).toEqual([
      0, 0, 1, 0,
      1, 0, 1, 1,
      1, 1, 0, 1,
      0, 1, 0, 0,
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

    const layout = extractUvLayout(mesh)

    expect(Array.from(layout.triangleCoordinates)).toEqual([
      0, 0, 1, 1, 0, 1,
    ])
    expect(layout.boundaryCoordinates).toHaveLength(12)
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

  it('T08 selects the requested UV channel without mutating UV0 or sharing its interpretation', () => {
    const geometry = createQuadGeometry()
    const original = Array.from(geometry.getAttribute('uv').array)
    for (const channel of [1, 2, 3] as const) {
      geometry.setAttribute(`uv${channel}`, new Float32BufferAttribute([-2, 0, -1, 0, -1, 1, -2, 1], 2))
      expect(getRawUvBounds(extractUvLayout(new Mesh(geometry, new MeshStandardMaterial()), channel))).toEqual({ minU: -2, minV: 0, maxU: -1, maxV: 1 })
    }
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual(original)
    geometry.deleteAttribute('uv1')
    expect(() => extractUvLayout(new Mesh(geometry, new MeshStandardMaterial()), 1)).toThrow('channel 1')
  })

  it('T11 excludes unused vertices, other slots and faces outside drawRange', () => {
    const geometry = createQuadGeometry()
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 20, 20, 1, 1, 0, 1, -999, 999], 2))
    geometry.addGroup(0, 3, 1)
    geometry.addGroup(3, 3, 0)
    const mesh = new Mesh(geometry, [new MeshStandardMaterial(), new MeshStandardMaterial()])
    geometry.setDrawRange(3, 3)
    expect(getRawUvBounds(extractUvLayout(mesh))).toEqual({ minU: 0, minV: 0, maxU: 1, maxV: 1 })
    geometry.clearGroups()
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 0)
    expect(extractUvLayout(mesh).triangleCoordinates).toHaveLength(6)
  })

  it('T12 rejects invalid UV numbers, indices, attributes and incomplete triangle ranges', () => {
    const geometry = createQuadGeometry()
    const mesh = new Mesh(geometry, new MeshStandardMaterial())
    geometry.setIndex([0, 1, 99])
    expect(() => extractUvLayout(mesh)).toThrow('vertex index')
    geometry.setIndex([0, 1, 2])
    geometry.getAttribute('uv').setXY(1, NaN, 0)
    expect(() => extractUvLayout(mesh)).toThrow('invalid UV coordinates')
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0], 3))
    expect(() => extractUvLayout(mesh)).toThrow('VEC2')
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2))
    geometry.setDrawRange(0, 2)
    expect(() => extractUvLayout(mesh)).toThrow('triangle groups')
  })

  it('T11 ignores UV entries beyond the rendered non-indexed position count', () => {
    const geometry = createQuadGeometry().toNonIndexed()
    const uv = geometry.getAttribute('uv')
    geometry.setAttribute('uv', new Float32BufferAttribute([...Array.from(uv.array), -999, 999, -999, 999, -999, 999], 2))
    const layout = extractUvLayout(new Mesh(geometry, new MeshStandardMaterial()))
    expect(layout.triangleCoordinates).toHaveLength(12)
    expect(getRawUvBounds(layout)).toEqual({ minU: 0, minV: 0, maxU: 1, maxV: 1 })
  })
})
