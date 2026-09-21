import { describe, expect, it } from 'vitest'
import { normalizeWorkbenchOptions } from './config'
import type { WorkbenchExtensionButton } from './types'

describe('normalizeWorkbenchOptions', () => {
  it('provides a complete default Workbench', () => {
    const options = normalizeWorkbenchOptions({ container: '#app' })

    expect(options.editorWidth).toBe(1024)
    expect(options.editorHeight).toBe(512)
    expect(options.historyLimit).toBe(50)
    expect(options.classNames).toEqual([])
    expect(options.appearance).toBeUndefined()
    expect(options.features.textFormatting).toBe(true)
    expect(Object.values(options.features).every(Boolean)).toBe(true)
    expect(Object.values(options.layout).every(Boolean)).toBe(true)
    expect(options.branding.title).toBe('CustomForge')
    expect(options.branding.logoUrl).toBeTruthy()
    expect(options.theme.accent).toBe('#268a4b')
    expect(options.theme.fontFamily).toContain('Nunito Sans')
    expect(options.theme.controlRadius).toBe('4px')
    expect(options.icons).toEqual({ enabled: true, sources: {} })
    expect(options.extensions).toEqual([])
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
      className: 'store-editor compact store-editor',
      appearance: {
        editor: { controlSize: 6 },
        viewer: { backgroundColor: '#eeeeee' },
      },
      icons: { enabled: false },
      extensions: [
        {
          id: 'acme.export',
          placement: 'globalActions',
          label: ' Export ',
          iconUrl: ' /export.svg ',
          className: 'store-command compact store-command',
          order: 20,
          onClick: () => undefined,
        },
      ],
    })

    expect(options.features.addText).toBe(false)
    expect(options.features.addImage).toBe(true)
    expect(options.layout.header).toBe(false)
    expect(options.layout.layers).toBe(true)
    expect(options.branding.title).toBe('Store editor')
    expect(options.branding.showSubtitle).toBe(false)
    expect(options.labels.addText).toBe('Type')
    expect(options.labels.addImage).toBe('Image')
    expect(options.labels.setImageAsBackground).toBe('Set as background')
    expect(options.labels.editorMode).toBe('2D')
    expect(options.labels.modelUrlPlaceholder).toContain('product.glb')
    expect(options.theme.accent).toBe('#0055aa')
    expect(options.classNames).toEqual(['store-editor', 'compact'])
    expect(options.appearance).toEqual({
      editor: { controlSize: 6 },
      viewer: { backgroundColor: '#eeeeee' },
    })
    expect(options.icons.enabled).toBe(false)
    expect(options.extensions).toHaveLength(1)
    expect(options.extensions[0]).toMatchObject({
      id: 'acme.export',
      placement: 'globalActions',
      label: 'Export',
      iconUrl: '/export.svg',
      showLabel: true,
      variant: 'secondary',
      order: 20,
      classNames: ['store-command', 'compact'],
      visible: true,
      disabled: false,
    })
  })

  it('accepts localized font names and error messages', () => {
    const options = normalizeWorkbenchOptions({
      container: '#app',
      fontFamilies: [{ value: 'Arial', label: '无衬线字体' }],
      formatError: () => '加载失败',
    })

    expect(options.fontFamilies).toEqual([
      { value: 'Arial', label: '无衬线字体' },
    ])
    expect(options.formatError(new Error('Failed'))).toBe('加载失败')
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

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'duplicate',
            placement: 'editorToolbar',
            label: 'First',
            onClick: () => undefined,
          },
          {
            id: 'duplicate',
            placement: 'globalActions',
            label: 'Second',
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('Extension id is duplicated: duplicate')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'icon-only',
            placement: 'editorToolbar',
            label: 'Icon only',
            showLabel: false,
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('must provide iconUrl')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'invalid id',
            placement: 'editorToolbar',
            label: 'Invalid',
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('Extension id must start with an alphanumeric character')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'invalid-order',
            placement: 'editorToolbar',
            label: 'Invalid order',
            order: Number.POSITIVE_INFINITY,
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('order must be a finite number')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'invalid-placement',
            placement: 'sidebar' as WorkbenchExtensionButton['placement'],
            label: 'Invalid placement',
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('has an invalid placement')

    expect(() =>
      normalizeWorkbenchOptions({
        container: '#app',
        extensions: [
          {
            id: 'invalid-variant',
            placement: 'editorToolbar',
            label: 'Invalid variant',
            variant: 'loud' as WorkbenchExtensionButton['variant'],
            onClick: () => undefined,
          },
        ],
      }),
    ).toThrow('has an invalid variant')
  })

  it('preserves extension callbacks and applies compact layer defaults', () => {
    const visible = () => true
    const disabled = () => false
    const onClick = async () => undefined
    const options = normalizeWorkbenchOptions({
      container: '#app',
      extensions: [
        {
          id: 'layer.pin',
          placement: 'layerActions',
          label: 'Pin layer',
          iconUrl: '/pin.svg',
          visible,
          disabled,
          onClick,
        },
      ],
    })

    expect(options.extensions[0]).toMatchObject({
      showLabel: false,
      variant: 'plain',
      visible,
      disabled,
      onClick,
    })
  })
})
