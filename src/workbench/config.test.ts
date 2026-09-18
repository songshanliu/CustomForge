import { describe, expect, it } from 'vitest'
import { normalizeWorkbenchOptions } from './config'

describe('normalizeWorkbenchOptions', () => {
  it('provides a complete default Workbench', () => {
    const options = normalizeWorkbenchOptions({ container: '#app' })

    expect(options.editorWidth).toBe(1024)
    expect(options.editorHeight).toBe(512)
    expect(options.historyLimit).toBe(50)
    expect(options.features.textFormatting).toBe(true)
    expect(Object.values(options.features).every(Boolean)).toBe(true)
    expect(Object.values(options.layout).every(Boolean)).toBe(true)
    expect(options.branding.title).toBe('CustomForge')
    expect(options.branding.logoUrl).toBeTruthy()
    expect(options.theme.accent).toBe('#268a4b')
    expect(options.theme.fontFamily).toContain('Nunito Sans')
    expect(options.theme.controlRadius).toBe('4px')
    expect(options.icons).toEqual({ enabled: true, sources: {} })
    expect(options.textPresets).toHaveLength(4)
    expect(options.textPresets[0]).toMatchObject({ fontSize: 22, width: 220 })
    expect(options.elements.some((asset) => asset.id === 'customforge-logo')).toBe(true)
  })

  it('overrides individual switches without disabling unrelated controls', () => {
    const options = normalizeWorkbenchOptions({
      container: '#app',
      features: { addText: false },
      layout: { header: false },
      branding: { title: 'Store editor', showSubtitle: false },
      labels: { addText: 'Type' },
      theme: { accent: '#0055aa' },
      icons: { enabled: false },
    })

    expect(options.features.addText).toBe(false)
    expect(options.features.addImage).toBe(true)
    expect(options.layout.header).toBe(false)
    expect(options.layout.layers).toBe(true)
    expect(options.branding.title).toBe('Store editor')
    expect(options.branding.showSubtitle).toBe(false)
    expect(options.labels.addText).toBe('Type')
    expect(options.labels.addImage).toBe('Image')
    expect(options.theme.accent).toBe('#0055aa')
    expect(options.icons.enabled).toBe(false)
  })

  it('validates history and asset identifiers', () => {
    expect(() =>
      normalizeWorkbenchOptions({ container: '#app', historyLimit: 0 }),
    ).toThrow('historyLimit must be a positive integer')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        assets: {
          elements: [
            { id: 'flower', name: 'Flower', url: '/flower.png' },
            { id: 'flower', name: 'Flower 2', url: '/flower-2.png' },
          ],
        },
      }),
    ).toThrow('Element asset id is duplicated: flower')
  })
})
