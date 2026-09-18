import { describe, expect, it } from 'vitest'
import { normalizeProductConfiguration } from './config'

describe('normalizeProductConfiguration', () => {
  it('uses bundled GLB defaults when no product is supplied', () => {
    expect(normalizeProductConfiguration()).toEqual({
      modelUrl: undefined,
      textureUrl: undefined,
      surfaceMesh: 'PrintArea',
      textureFlipY: false,
    })
  })

  it('normalizes remote product values', () => {
    expect(
      normalizeProductConfiguration({
        modelUrl: '  https://example.com/product.glb  ',
        textureUrl: '  https://example.com/texture.png  ',
        surfaceMesh: '  Label  ',
      }),
    ).toEqual({
      modelUrl: 'https://example.com/product.glb',
      textureUrl: 'https://example.com/texture.png',
      surfaceMesh: 'Label',
      textureFlipY: false,
    })
  })
})

