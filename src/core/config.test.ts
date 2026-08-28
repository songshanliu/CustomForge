import { describe, expect, it } from 'vitest'
import { normalizeProductConfiguration } from './config'

describe('normalizeProductConfiguration', () => {
  it('uses demo defaults when no product is supplied', () => {
    expect(normalizeProductConfiguration()).toEqual({
      model: undefined,
      modelUrl: undefined,
      textureUrl: undefined,
      surfaceMesh: 'PrintArea',
      textureFlipY: true,
      designGuide: {
        visible: true,
        showUv: true,
        templateUrl: undefined,
        safeArea: undefined,
        bleedArea: undefined,
      },
      designAreas: {
        mode: 'existing-uv',
        maxAreas: 4,
        textureSize: 1024,
        strategy: 'balanced',
        allowSurfacePick: true,
      },
    })
  })

  it('normalizes remote product values', () => {
    expect(
      normalizeProductConfiguration({
        modelUrl: '  https://example.com/product.glb  ',
        textureUrl: '  https://example.com/texture.png  ',
        surfaceMesh: '  Label  ',
        designGuide: {
          templateUrl: '  https://example.com/template.svg  ',
          safeArea: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
        },
      }),
    ).toEqual({
      model: undefined,
      modelUrl: 'https://example.com/product.glb',
      textureUrl: 'https://example.com/texture.png',
      surfaceMesh: 'Label',
      textureFlipY: false,
      designGuide: {
        visible: true,
        showUv: true,
        templateUrl: 'https://example.com/template.svg',
        safeArea: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
        bleedArea: undefined,
      },
      designAreas: {
        mode: 'existing-uv',
        maxAreas: 4,
        textureSize: 1024,
        strategy: 'balanced',
        allowSurfacePick: true,
      },
    })
  })

  it('uses automatic areas when a model is provided without a mesh name', () => {
    const configuration = normalizeProductConfiguration({
      model: new ArrayBuffer(8),
      textureFlipY: true,
    })

    expect(configuration.designAreas.mode).toBe('auto')
    expect(configuration.textureFlipY).toBe(false)
  })

  it('rejects ambiguous model sources and invalid texture sizes', () => {
    expect(() =>
      normalizeProductConfiguration({
        model: new ArrayBuffer(8),
        modelUrl: '/product.glb',
      }),
    ).toThrow('product.model and product.modelUrl cannot be used together')

    expect(() =>
      normalizeProductConfiguration({
        modelUrl: '/product.glb',
        designAreas: { textureSize: 1000 },
      }),
    ).toThrow(
      'designAreas.textureSize must be a power of two between 256 and 4096',
    )
  })

  it('rejects guide areas outside normalized canvas bounds', () => {
    expect(() =>
      normalizeProductConfiguration({
        designGuide: {
          safeArea: { x: 0.5, y: 0, width: 0.6, height: 1 },
        },
      }),
    ).toThrow('designGuide.safeArea must stay within normalized canvas bounds')
  })
})

