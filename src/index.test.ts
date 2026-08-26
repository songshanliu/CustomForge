import { describe, expect, it } from 'vitest'
import * as publicApi from './index'

describe('public API', () => {
  it('only exposes the approved runtime entries', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'ProductCustomizer',
      'createCustomizer',
    ])
  })
})
