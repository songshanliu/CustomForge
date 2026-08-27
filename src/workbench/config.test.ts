import { describe, expect, it } from 'vitest'
import { normalizeWorkbenchOptions } from './config'

describe('normalizeWorkbenchOptions', () => {
  it('provides a complete default Workbench', () => {
    const options = normalizeWorkbenchOptions({ container: '#app' })

    expect(options.editorWidth).toBe(1024)
    expect(options.editorHeight).toBe(512)
    expect(Object.values(options.features).every(Boolean)).toBe(true)
    expect(Object.values(options.layout).every(Boolean)).toBe(true)
    expect(options.brandTitle).toBe('CustomForge')
  })

  it('overrides individual switches without disabling unrelated controls', () => {
    const options = normalizeWorkbenchOptions({
      container: '#app',
      features: { addText: false },
      layout: { header: false },
      branding: { title: 'Store editor' },
    })

    expect(options.features.addText).toBe(false)
    expect(options.features.addImage).toBe(true)
    expect(options.layout.header).toBe(false)
    expect(options.layout.layers).toBe(true)
    expect(options.brandTitle).toBe('Store editor')
  })
})
