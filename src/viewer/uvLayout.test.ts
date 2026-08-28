import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import { extractUvGuideLayout } from './uvLayout'

describe('extractUvGuideLayout', () => {
  it('keeps island boundaries and removes a shared triangle edge', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ], 2))
    geometry.setIndex([0, 1, 2, 0, 2, 3])

    const layout = extractUvGuideLayout(geometry)

    expect(layout.simplified).toBe(false)
    expect(layout.segments).toHaveLength(4)
  })

  it('keeps overlapping UV islands from separate surface positions', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      1, 0, 1,
      0, 1, 1,
    ], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([
      0, 0,
      1, 0,
      0, 1,
      0, 0,
      1, 0,
      0, 1,
    ], 2))

    expect(extractUvGuideLayout(geometry).segments).toHaveLength(6)
  })

  it('samples boundaries above the requested segment limit', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ], 2))
    geometry.setIndex([0, 1, 2, 0, 2, 3])

    const layout = extractUvGuideLayout(geometry, 2)

    expect(layout.simplified).toBe(true)
    expect(layout.segments).toHaveLength(2)
  })

  it('rejects geometry without UV coordinates', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ], 3))

    expect(() => extractUvGuideLayout(geometry)).toThrow(
      'Customizable mesh does not contain UV coordinates',
    )
  })

  it('rejects an invalid segment limit', () => {
    const geometry = new BufferGeometry()

    expect(() => extractUvGuideLayout(geometry, 0)).toThrow(
      'maxSegments must be a positive integer',
    )
  })

  it('rejects an empty UV geometry', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('uv', new Float32BufferAttribute([], 2))

    expect(() => extractUvGuideLayout(geometry)).toThrow(
      'Customizable mesh must contain triangle geometry',
    )
  })
})
