import { describe, expect, it } from 'vitest'
import {
  calculateContainmentOffset,
  calculateContainmentScale,
} from './objectBounds'

describe('object boundary calculations', () => {
  it('keeps the original scale when the object fits', () => {
    expect(
      calculateContainmentScale(
        { left: 80, top: 90, width: 500, height: 180 },
        1024,
        512,
      ),
    ).toBe(1)
  })

  it('uses the stricter axis when the object is larger than the canvas', () => {
    expect(
      calculateContainmentScale(
        { left: 0, top: 0, width: 1200, height: 800 },
        600,
        500,
      ),
    ).toBe(0.5)
  })

  it('moves an object back from the left and top edges', () => {
    expect(
      calculateContainmentOffset(
        { left: -40, top: -25, width: 300, height: 120 },
        1024,
        512,
      ),
    ).toEqual({ x: 40, y: 25 })
  })

  it('moves an object back from the right and bottom edges', () => {
    expect(
      calculateContainmentOffset(
        { left: 900, top: 460, width: 200, height: 100 },
        1024,
        512,
      ),
    ).toEqual({ x: -76, y: -48 })
  })
})
