import { describe, expect, it } from 'vitest'
import { ActiveSelection, Rect, util } from 'fabric'
import { boundedObjects, captureGeometry, constrainCandidate, liveBounds, normalizeObjectBoundaryOptions, validGeometry } from './objectBoundary'

const neverOverflow = () => false
const fits = (object: Rect, width = 1380, height = 800) => {
  const bounds = liveBounds(object)
  expect(bounds.left).toBeGreaterThanOrEqual(-1e-7)
  expect(bounds.top).toBeGreaterThanOrEqual(-1e-7)
  expect(bounds.left + bounds.width).toBeLessThanOrEqual(width + 1e-7)
  expect(bounds.top + bounds.height).toBeLessThanOrEqual(height + 1e-7)
}

describe('stable object boundary projection', () => {
  it('defaults to contain and validates the opt-in overflow strategy', () => {
    expect(normalizeObjectBoundaryOptions()).toEqual({ background: 'contain' })
    expect(normalizeObjectBoundaryOptions({ background: 'overflow' })).toEqual({ background: 'overflow' })
    expect(() => normalizeObjectBoundaryOptions({ background: 'invalid' as 'contain' })).toThrow()
  })

  it.each([0, 30, 90])('preserves the non-active axis and opposite anchor at %s degrees', (angle) => {
    for (const axis of ['x', 'y'] as const) {
      const object = new Rect({ left: 690, top: 400, originX: 'center', originY: 'center', width: 160, height: 110, scaleX: 1.8, scaleY: 1.1, angle, strokeWidth: 0 })
      const start = captureGeometry(object)
      const originX = axis === 'x' ? 'left' : 'center', originY = axis === 'y' ? 'bottom' : 'center'
      const point = object.getPositionByOrigin(originX, originY)
      object.set(axis === 'x' ? { scaleX: 40 } : { scaleY: 40 })
      object.setPositionByOrigin(point, originX, originY)
      constrainCandidate(object, start, 1380, 800, neverOverflow, { point, originX, originY })
      expect(axis === 'x' ? object.scaleY : object.scaleX).toBe(axis === 'x' ? start.scaleY : start.scaleX)
      const anchor = object.getPositionByOrigin(originX, originY)
      expect(anchor.x).toBeCloseTo(point.x, 8)
      expect(anchor.y).toBeCloseTo(point.y, 8)
      fits(object)
    }
  })

  it('preserves an initially non-uniform ratio during corner scaling', () => {
    const object = new Rect({ left: 100, top: 100, width: 100, height: 100, scaleX: 2, scaleY: 1, strokeWidth: 0 })
    const start = captureGeometry(object), point = object.getPositionByOrigin('left', 'top')
    object.set({ scaleX: 40, scaleY: 20 })
    constrainCandidate(object, start, 1380, 800, neverOverflow, { point, originX: 'left', originY: 'top' })
    expect(object.scaleX / object.scaleY).toBeCloseTo(2, 10)
    fits(object)
  })

  it('leaves overflow geometry unchanged while rejecting non-finite geometry', () => {
    const object = new Rect({ width: 100, height: 50, left: -200, scaleX: 30, strokeWidth: 0 })
    const candidate = captureGeometry(object)
    constrainCandidate(object, candidate, 1380, 800, () => true)
    expect(captureGeometry(object)).toEqual(candidate)
    object.set({ scaleX: Number.MAX_VALUE })
    expect(validGeometry(object)).toBe(false)
  })

  it('uses the short rotation arc when a clockwise-normalized angle crosses zero', () => {
    const object = new Rect({ left: 690, top: 400, originX: 'center', originY: 'center', width: 1000, height: 100, angle: 0, strokeWidth: 0 })
    const start = captureGeometry(object), point = object.getPositionByOrigin('center', 'center')
    object.set({ angle: 359 })
    constrainCandidate(object, start, 1380, 800, neverOverflow, { point, originX: 'center', originY: 'center' })
    expect(object.angle).toBe(359)
    fits(object)
  })

  it('keeps the same world bounds before and after decomposing a skewed selection member', () => {
    const object = new Rect({ left: 300, top: 240, width: 130, height: 90, skewX: 14, skewY: -8, flipX: true, strokeWidth: 1 })
    const group = new ActiveSelection([object])
    group.set({ scaleX: 1.5, scaleY: 0.8, angle: 30 })
    const before = liveBounds(object)
    const restored = new Rect({ width: object.width, height: object.height, strokeWidth: object.strokeWidth })
    util.applyTransformToObject(restored, object.calcTransformMatrix())
    const after = liveBounds(restored)
    for (const key of ['left', 'top', 'width', 'height'] as const) expect(after[key]).toBeCloseTo(before[key], 8)
  })

  it('projects only constrained members of a mixed selection without changing child coordinates', () => {
    const background = new Rect({ width: 1000, height: 1000, left: -300, top: -300, strokeWidth: 0 })
    const element = new Rect({ width: 100, height: 100, left: 300, top: 200, strokeWidth: 0 })
    const group = new ActiveSelection([background, element])
    const allowsOverflow = (object: object) => object === background
    expect(boundedObjects(group, allowsOverflow)).toEqual([element])
    const start = captureGeometry(group), childStart = captureGeometry(element)
    group.set({ scaleX: 8, scaleY: 8 })
    constrainCandidate(group, start, 1380, 800, allowsOverflow)
    expect(captureGeometry(element)).toEqual(childStart)
    fits(element)
  })
})
