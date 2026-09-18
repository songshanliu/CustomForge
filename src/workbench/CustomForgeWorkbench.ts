import { resolveElement } from '../core/dom'
import type {
  DesignImageRole,
  DesignObject,
  TextAlignment,
  TextDesignObject,
  UpdateTextOptions,
} from '../core/types'
import { ProductCustomizer } from '../customizer/ProductCustomizer'
import {
  normalizeWorkbenchOptions,
  type NormalizedWorkbenchOptions,
} from './config'
import { renderWorkbenchIcons } from './icons'
import { createWorkbenchElement } from './template'
import type {
  WorkbenchAsset,
  WorkbenchFeatureName,
  WorkbenchFeatures,
  WorkbenchIconConfiguration,
  WorkbenchLabels,
  WorkbenchLayout,
  WorkbenchLayoutName,
  WorkbenchOptions,
  WorkbenchStatusMode,
  WorkbenchTextPreset,
  WorkbenchTheme,
} from './types'

type ImageTab = 'upload' | 'backgrounds' | 'elements'

const DIALOG_CLOSE_DELAY_MS = 180

const DEFAULT_TEXT_FONTS = [
  'Arial',
  'Georgia',
  'Trebuchet MS',
  'Verdana',
  'Times New Roman',
  'Courier New',
  'Brush Script MT',
  'Nunito Sans',
]

interface SelectedImage {
  src: string
  name: string
  role: DesignImageRole
  objectUrl?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function requiredElement<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Workbench element was not found: ${selector}`)
  }
  return element
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = filename
  anchor.href = url
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function applyLabels(element: HTMLElement, labels: WorkbenchLabels): void {
  element.setAttribute('aria-label', labels.workbench)
  element.querySelectorAll<HTMLElement>('[data-label]').forEach((target) => {
    const key = target.dataset.label as keyof WorkbenchLabels
    target.textContent = labels[key]
  })
  element
    .querySelectorAll<HTMLInputElement>('[data-placeholder-label]')
    .forEach((target) => {
      const key = target.dataset.placeholderLabel as keyof WorkbenchLabels
      target.placeholder = labels[key]
    })
  element
    .querySelectorAll<HTMLElement>('[data-control-label]')
    .forEach((target) => {
      const key = target.dataset.controlLabel as keyof WorkbenchLabels
      const label = labels[key] || String(key)
      target.title = label
      target.setAttribute('aria-label', label)
    })
  element
    .querySelectorAll<HTMLElement>('[data-region-label]')
    .forEach((target) => {
      const key = target.dataset.regionLabel as keyof WorkbenchLabels
      target.setAttribute('aria-label', labels[key] || String(key))
    })
}

function applyBranding(
  element: HTMLElement,
  options: NormalizedWorkbenchOptions['branding'],
): void {
  const logo = requiredElement<HTMLImageElement>(element, '[data-role="brand-logo"]')
  const title = requiredElement(element, '[data-role="brand-title"]')
  const subtitle = requiredElement(element, '[data-role="brand-subtitle"]')
  const copy = requiredElement(element, '[data-role="brand-copy"]')
  const brand = requiredElement(element, '[data-role="brand"]')

  logo.src = options.logoUrl
  logo.alt = options.logoAlt
  logo.hidden = !options.showLogo
  title.textContent = options.title
  title.hidden = !options.showTitle || options.title.length === 0
  subtitle.textContent = options.subtitle
  subtitle.hidden = !options.showSubtitle || options.subtitle.length === 0
  copy.hidden = title.hidden && subtitle.hidden
  brand.hidden = logo.hidden && copy.hidden
  brand.setAttribute('aria-label', options.title || options.logoAlt)
}

function applyTheme(element: HTMLElement, theme: WorkbenchTheme): void {
  element.style.setProperty('--cfw-ink', theme.ink)
  element.style.setProperty('--cfw-muted', theme.muted)
  element.style.setProperty('--cfw-line', theme.border)
  element.style.setProperty('--cfw-surface', theme.surface)
  element.style.setProperty('--cfw-surface-muted', theme.surfaceMuted)
  element.style.setProperty('--cfw-stage', theme.stage)
  element.style.setProperty('--cfw-accent', theme.accent)
  element.style.setProperty('--cfw-accent-hover', theme.accentHover)
  element.style.setProperty('--cfw-accent-contrast', theme.accentContrast)
  element.style.setProperty('--cfw-danger', theme.danger)
  element.style.setProperty('--cfw-font-family', theme.fontFamily)
  element.style.setProperty('--cfw-control-radius', theme.controlRadius)
}

function formatCount(labels: WorkbenchLabels, count: number): string {
  const template = count === 1 ? labels.objectCountOne : labels.objectCountMany
  return template.replace('{count}', String(count))
}

/**
 * 提供可配置默认界面的产品定制工作台
 *
 * 功能和布局开关只控制 Workbench 自带界面
 * 底层 ProductCustomizer 仍通过 customizer 属性提供完整公共 API
 * 不再使用实例时必须调用 destroy
 */
export class CustomForgeWorkbench {
  /** Workbench 使用的底层无界面定制器 */
  readonly customizer: ProductCustomizer

  /** Workbench 根元素 */
  readonly element: HTMLElement

  private readonly host: HTMLElement
  private readonly abortController = new AbortController()
  private readonly dialogCloseTimers = new Map<HTMLDialogElement, number>()
  private readonly unsubscribe: Array<() => void> = []
  private readonly features: WorkbenchFeatures
  private readonly layout: WorkbenchLayout
  private readonly labels: WorkbenchLabels
  private readonly icons: Required<WorkbenchIconConfiguration>
  private readonly textPresets: WorkbenchTextPreset[]
  private readonly backgrounds: WorkbenchAsset[]
  private readonly elements: WorkbenchAsset[]
  private readonly layerList: HTMLOListElement
  private readonly deleteButton: HTMLButtonElement
  private readonly undoButton: HTMLButtonElement
  private readonly redoButton: HTMLButtonElement
  private readonly statusLabel: HTMLElement
  private readonly objectCountLabel: HTMLElement
  private readonly imageInput: HTMLInputElement
  private readonly designInput: HTMLInputElement
  private readonly loadDesignButton: HTMLButtonElement
  private readonly textDialog: HTMLDialogElement
  private readonly textForm: HTMLFormElement
  private readonly textToolbar: HTMLElement
  private readonly textFontFamily: HTMLSelectElement
  private readonly textFontSize: HTMLInputElement
  private readonly textColor: HTMLInputElement
  private readonly textBackgroundColor: HTMLInputElement
  private readonly textLineHeight: HTMLInputElement
  private readonly textLetterSpacing: HTMLInputElement
  private readonly imageDialog: HTMLDialogElement
  private readonly imageForm: HTMLFormElement
  private readonly imageSubmitButton: HTMLButtonElement
  private readonly productDialog: HTMLDialogElement
  private readonly remoteForm: HTMLFormElement
  private readonly submitProductButton: HTMLButtonElement
  private selectedObjectIds = new Set<string>()
  private selectedTextPresetId?: string
  private selectedImage?: SelectedImage
  private activeImageTab: ImageTab = 'upload'
  private layerSignature = ''
  private draggedObjectId?: string
  private destroyed = false

  private constructor(
    host: HTMLElement,
    element: HTMLElement,
    customizer: ProductCustomizer,
    options: NormalizedWorkbenchOptions,
  ) {
    this.host = host
    this.element = element
    this.customizer = customizer
    this.features = options.features
    this.layout = options.layout
    this.labels = options.labels
    this.icons = options.icons
    this.textPresets = options.textPresets
    this.backgrounds = options.backgrounds
    this.elements = options.elements
    this.selectedTextPresetId = this.textPresets[0]?.id
    this.layerList = requiredElement(element, '[data-role="layer-list"]')
    this.deleteButton = this.action('delete-selection')
    this.undoButton = this.action('undo')
    this.redoButton = this.action('redo')
    this.statusLabel = requiredElement(element, '[data-role="status-label"]')
    this.objectCountLabel = requiredElement(element, '[data-role="object-count"]')
    this.imageInput = requiredElement(element, '[data-role="image-input"]')
    this.designInput = requiredElement(element, '[data-role="design-input"]')
    this.loadDesignButton = this.action('load-design')
    this.textDialog = requiredElement(element, '[data-role="text-dialog"]')
    this.textForm = requiredElement(element, '[data-role="text-form"]')
    this.textToolbar = requiredElement(element, '[data-role="text-toolbar"]')
    this.textFontFamily = requiredElement(element, '[data-role="text-font-family"]')
    this.textFontSize = requiredElement(element, '[data-role="text-font-size"]')
    this.textColor = requiredElement(element, '[data-role="text-format-color"]')
    this.textBackgroundColor = requiredElement(
      element,
      '[data-role="text-background-color"]',
    )
    this.textLineHeight = requiredElement(element, '[data-role="text-line-height"]')
    this.textLetterSpacing = requiredElement(
      element,
      '[data-role="text-letter-spacing"]',
    )
    this.imageDialog = requiredElement(element, '[data-role="image-dialog"]')
    this.imageForm = requiredElement(element, '[data-role="image-form"]')
    this.imageSubmitButton = this.action('submit-image')
    this.productDialog = requiredElement(element, '[data-role="product-dialog"]')
    this.remoteForm = requiredElement(element, '[data-role="remote-form"]')
    this.submitProductButton = this.action('submit-product')

    this.renderTextFontOptions()
    this.renderTextPresets()
    this.renderAssetPresets()
    this.bindEvents()
    this.applyVisibility()
    this.setImageTab('upload')
    this.updateHistoryButtons()
    this.renderLayers(true)
    this.updateTextToolbar()
    this.setStatus(this.labels.productReady)
  }

  /**
   * 创建 Workbench 并完成底层定制器初始化
   *
   * @param options 挂载容器、产品资源、功能、外观和素材配置
   * @returns 初始化完成的 Workbench
   * @throws 挂载容器无效或产品初始化失败时清理已创建界面并继续抛出错误
   */
  static async create(options: WorkbenchOptions): Promise<CustomForgeWorkbench> {
    const host = resolveElement(options.container, 'Workbench')
    const normalized = normalizeWorkbenchOptions(options)
    const element = createWorkbenchElement()
    applyLabels(element, normalized.labels)
    applyBranding(element, normalized.branding)
    applyTheme(element, normalized.theme)
    requiredElement(element, '[data-role="resolution"]').textContent =
      `${normalized.editorWidth} x ${normalized.editorHeight}`
    host.replaceChildren(element)
    renderWorkbenchIcons(element, normalized.icons)

    try {
      const customizer = await ProductCustomizer.create({
        editor: requiredElement(element, '[data-role="editor-host"]'),
        viewer: requiredElement(element, '[data-role="viewer-host"]'),
        editorWidth: normalized.editorWidth,
        editorHeight: normalized.editorHeight,
        historyLimit: normalized.historyLimit,
        product: normalized.product,
      })
      return new CustomForgeWorkbench(host, element, customizer, normalized)
    } catch (error) {
      host.replaceChildren()
      throw error
    }
  }

  /**
   * 在运行时显示或隐藏某项内置功能控件
   *
   * 该方法不限制通过 customizer 属性直接调用对应核心 API
   *
   * @param feature 功能名称
   * @param enabled 是否显示并启用对应控件
   */
  setFeature(feature: WorkbenchFeatureName, enabled: boolean): void {
    this.features[feature] = enabled
    if (feature === 'loadRemoteProduct' && !enabled && this.productDialog.open) {
      this.closeDialog(this.productDialog)
    }
    if (feature === 'addText' && !enabled && this.textDialog.open) {
      this.closeDialog(this.textDialog)
    }
    if (feature === 'addImage' && !enabled && this.imageDialog.open) {
      this.closeDialog(this.imageDialog)
    }
    if (
      (feature === 'presetBackgrounds' && this.activeImageTab === 'backgrounds') ||
      (feature === 'presetElements' && this.activeImageTab === 'elements')
    ) {
      this.setImageTab('upload')
    }
    this.applyVisibility()
    this.renderLayers(true)
    this.updateTextToolbar()
  }

  /**
   * 在运行时显示或隐藏 Workbench 布局区域
   *
   * @param section 布局区域名称
   * @param visible 是否显示该区域
   */
  setLayout(section: WorkbenchLayoutName, visible: boolean): void {
    this.layout[section] = visible
    this.applyVisibility()
    this.updateTextToolbar()
  }

  /**
   * 更新底部状态栏内容
   *
   * @param message 状态文字
   * @param mode 状态样式，默认为 ready
   */
  setStatus(message: string, mode: WorkbenchStatusMode = 'ready'): void {
    this.statusLabel.textContent = message
    this.element.dataset.status = mode
  }

  /** 释放 DOM 事件、核心实例和 Workbench 挂载内容 */
  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.releaseImageSelection()
    this.dialogCloseTimers.forEach((timer) => window.clearTimeout(timer))
    this.dialogCloseTimers.clear()
    this.abortController.abort()
    this.unsubscribe.splice(0).forEach((stop) => stop())
    this.customizer.destroy()
    this.host.replaceChildren()
  }

  private bindEvents(): void {
    const signal = this.abortController.signal

    this.unsubscribe.push(
      this.customizer.on('change', ({ objectCount }) => {
        this.updateObjectCount(objectCount)
        this.renderLayers()
        this.updateTextToolbar()
      }),
      this.customizer.on('selectionchange', ({ objectIds }) => {
        this.selectedObjectIds = new Set(objectIds)
        this.deleteButton.disabled = objectIds.length === 0
        this.renderLayers()
        this.updateTextToolbar()
      }),
      this.customizer.on('historychange', () => this.updateHistoryButtons()),
      this.customizer.on('status', ({ message }) =>
        this.setStatus(this.localizeStatus(message)),
      ),
      this.customizer.on('error', ({ error }) =>
        this.setStatus(error.message, 'error'),
      ),
    )

    this.element.addEventListener(
      'click',
      (event) => this.handleRootClick(event),
      { signal },
    )
    this.element.addEventListener(
      'keydown',
      (event) => {
        this.handleImageTabShortcut(event)
        this.handleHistoryShortcut(event)
      },
      { signal },
    )
    this.textForm.addEventListener(
      'submit',
      (event) => this.addTextFromDialog(event),
      { signal },
    )
    this.imageForm.addEventListener(
      'submit',
      (event) => void this.addImageFromDialog(event),
      { signal },
    )
    this.remoteForm.addEventListener(
      'submit',
      (event) => void this.loadRemoteProduct(event),
      { signal },
    )
    requiredElement<HTMLInputElement>(this.element, '[data-role="text-value"]')
      .addEventListener('input', (event) => {
        const input = event.currentTarget as HTMLInputElement
        input.setCustomValidity('')
        this.updateTextPreviews()
      }, { signal })
    requiredElement<HTMLInputElement>(this.element, '[data-role="text-color"]')
      .addEventListener('input', () => this.updateTextPreviews(), { signal })
    this.textFontFamily.addEventListener('change', () => {
      if (this.textFontFamily.value) {
        this.updateSelectedText({ fontFamily: this.textFontFamily.value })
      }
    }, { signal })
    this.textFontSize.addEventListener('change', () => {
      const value = this.textFontSize.valueAsNumber
      if (Number.isFinite(value)) {
        this.updateSelectedText({ fontSize: value })
      }
    }, { signal })
    this.textColor.addEventListener('input', () => {
      this.updateSelectedText({ color: this.textColor.value })
    }, { signal })
    this.textBackgroundColor.addEventListener('input', () => {
      this.updateSelectedText({ backgroundColor: this.textBackgroundColor.value })
    }, { signal })
    this.textLineHeight.addEventListener('change', () => {
      const value = this.textLineHeight.valueAsNumber
      if (Number.isFinite(value)) {
        this.updateSelectedText({ lineHeight: value })
      }
    }, { signal })
    this.textLetterSpacing.addEventListener('change', () => {
      const value = this.textLetterSpacing.valueAsNumber
      if (Number.isFinite(value)) {
        this.updateSelectedText({ charSpacing: value })
      }
    }, { signal })
    this.imageInput.addEventListener(
      'change',
      () => this.selectUploadedImage(),
      { signal },
    )
    this.designInput.addEventListener(
      'change',
      () => void this.loadSelectedDesign(),
      { signal },
    )
    this.imageDialog.addEventListener(
      'close',
      () => this.resetImageSelection(),
      { signal },
    )
    for (const dialog of [this.textDialog, this.imageDialog, this.productDialog]) {
      dialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault()
          this.closeDialog(dialog)
        },
        { signal },
      )
      dialog.addEventListener('close', () => this.clearDialogClose(dialog), {
        signal,
      })
    }
    this.layerList.addEventListener(
      'dblclick',
      (event) => this.handleLayerRename(event),
      { signal },
    )
    this.layerList.addEventListener(
      'dragstart',
      (event) => this.handleLayerDragStart(event),
      { signal },
    )
    this.layerList.addEventListener(
      'dragover',
      (event) => this.handleLayerDragOver(event),
      { signal },
    )
    this.layerList.addEventListener(
      'drop',
      (event) => this.handleLayerDrop(event),
      { signal },
    )
    this.layerList.addEventListener(
      'dragend',
      () => this.clearLayerDragState(),
      { signal },
    )
    window.addEventListener('beforeunload', () => this.destroy(), {
      once: true,
      signal,
    })
  }

  private handleRootClick(event: MouseEvent): void {
    const target = event.target as Element
    const textStyle = target.closest<HTMLButtonElement>('[data-text-style]')
    if (textStyle?.dataset.textStyle) {
      this.toggleSelectedTextStyle(
        textStyle.dataset.textStyle as 'bold' | 'italic' | 'underline',
      )
      return
    }

    const textAlign = target.closest<HTMLButtonElement>('[data-text-align]')
    if (textAlign?.dataset.textAlign) {
      this.updateSelectedText({
        textAlign: textAlign.dataset.textAlign as TextAlignment,
      })
      return
    }

    const layerAction = target.closest<HTMLButtonElement>('[data-layer-action]')
    if (layerAction) {
      this.handleLayerAction(layerAction)
      return
    }

    const textPreset = target.closest<HTMLButtonElement>('[data-text-preset-id]')
    if (textPreset?.dataset.textPresetId) {
      this.selectTextPreset(textPreset.dataset.textPresetId)
      return
    }

    const asset = target.closest<HTMLButtonElement>('[data-asset-id]')
    if (asset?.dataset.assetId && asset.dataset.assetRole) {
      this.selectPresetAsset(
        asset.dataset.assetId,
        asset.dataset.assetRole as DesignImageRole,
      )
      return
    }

    const tab = target.closest<HTMLButtonElement>('[data-image-tab]')
    if (tab?.dataset.imageTab) {
      this.setImageTab(tab.dataset.imageTab as ImageTab)
      return
    }

    const command = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action
    switch (command) {
      case 'open-text-dialog':
        this.openTextDialog()
        break
      case 'edit-text': {
        const selected = this.selectedTextObjects()
        if (selected?.length === 1) {
          this.customizer.editText(selected[0].id)
        }
        break
      }
      case 'toggle-text-background':
        this.toggleSelectedTextBackground()
        break
      case 'open-image-dialog':
        this.openImageDialog()
        break
      case 'undo':
        void this.runHistory('undo')
        break
      case 'redo':
        void this.runHistory('redo')
        break
      case 'save-design':
        this.saveDesign()
        break
      case 'load-design':
        this.designInput.click()
        break
      case 'delete-selection':
        this.customizer.deleteSelected()
        break
      case 'reset-view':
        this.customizer.resetView()
        break
      case 'export-texture':
        this.exportTexture()
        break
      case 'load-remote':
        this.showDialog(this.productDialog)
        break
      case 'close-text-dialog':
        this.closeDialog(this.textDialog)
        break
      case 'close-image-dialog':
        this.closeDialog(this.imageDialog)
        break
      case 'close-product-dialog':
        this.closeDialog(this.productDialog)
        break
      case 'choose-image':
        this.imageInput.click()
        break
      case 'use-demo':
        void this.loadDemoProduct()
        break
    }
  }

  private handleHistoryShortcut(event: KeyboardEvent): void {
    if (!this.features.undoRedo || (!event.ctrlKey && !event.metaKey) || event.altKey) {
      return
    }
    const target = event.target as HTMLElement
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    ) {
      return
    }

    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      void this.runHistory('undo')
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault()
      void this.runHistory('redo')
    }
  }

  private handleImageTabShortcut(event: KeyboardEvent): void {
    const current = (event.target as Element).closest<HTMLButtonElement>(
      '[data-image-tab]',
    )
    if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>('[data-image-tab]'),
    ).filter((tab) => !tab.hidden)
    const currentIndex = tabs.indexOf(current)
    if (currentIndex < 0 || tabs.length === 0) {
      return
    }

    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
          tabs.length
    const next = tabs[nextIndex]
    if (next?.dataset.imageTab) {
      this.setImageTab(next.dataset.imageTab as ImageTab)
      next.focus()
    }
  }

  private action(name: string): HTMLButtonElement {
    return requiredElement(this.element, `[data-action="${name}"]`)
  }

  private showDialog(dialog: HTMLDialogElement): void {
    this.clearDialogClose(dialog)
    if (!dialog.open) {
      dialog.showModal()
    }
  }

  private closeDialog(dialog: HTMLDialogElement): void {
    if (!dialog.open || dialog.dataset.closing === 'true') {
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.close()
      return
    }

    dialog.dataset.closing = 'true'
    const timer = window.setTimeout(() => {
      this.dialogCloseTimers.delete(dialog)
      delete dialog.dataset.closing
      if (dialog.open) {
        dialog.close()
      }
    }, DIALOG_CLOSE_DELAY_MS)
    this.dialogCloseTimers.set(dialog, timer)
  }

  private clearDialogClose(dialog: HTMLDialogElement): void {
    const timer = this.dialogCloseTimers.get(dialog)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      this.dialogCloseTimers.delete(dialog)
    }
    delete dialog.dataset.closing
  }

  private applyVisibility(): void {
    this.element.querySelectorAll<HTMLElement>('[data-feature]').forEach((element) => {
      const feature = element.dataset.feature as WorkbenchFeatureName
      element.hidden = !this.features[feature]
    })
    this.element.querySelectorAll<HTMLElement>('[data-layout]').forEach((element) => {
      const section = element.dataset.layout as WorkbenchLayoutName
      element.hidden = !this.layout[section]
    })

    const historyVisible = this.features.undoRedo
    const insertVisible = this.features.addText || this.features.addImage
    const documentVisible = this.features.saveDesign || this.features.loadDesign
    const selectionVisible = this.features.deleteSelection
    this.toolGroup('history').hidden = !historyVisible
    this.toolGroup('insert').hidden = !insertVisible
    this.toolGroup('document').hidden = !documentVisible
    this.toolGroup('history-separator').hidden =
      !historyVisible || (!insertVisible && !documentVisible && !selectionVisible)
    this.toolGroup('document-separator').hidden =
      !insertVisible || (!documentVisible && !selectionVisible)
    this.toolGroup('selection-separator').hidden =
      !selectionVisible || (!historyVisible && !insertVisible && !documentVisible)

    const toolbar = requiredElement<HTMLElement>(this.element, '[data-layout="toolbar"]')
    toolbar.hidden =
      !this.layout.toolbar ||
      (!historyVisible && !insertVisible && !documentVisible && !selectionVisible)
    this.element.dataset.layers = this.layout.layers ? 'visible' : 'hidden'

    const brandHidden = requiredElement(this.element, '[data-role="brand"]').hidden
    const hasGlobalActions =
      this.features.loadRemoteProduct || this.features.exportTexture
    const topbar = requiredElement<HTMLElement>(this.element, '[data-layout="header"]')
    topbar.hidden = !this.layout.header || (brandHidden && !hasGlobalActions)

    renderWorkbenchIcons(this.element, this.icons)
    this.updateTextToolbar()
  }

  private toolGroup(name: string): HTMLElement {
    return requiredElement(this.element, `[data-tool-group="${name}"]`)
  }

  private updateObjectCount(objectCount: number): void {
    this.objectCountLabel.textContent = formatCount(this.labels, objectCount)
    requiredElement(this.element, '[data-role="layer-count"]').textContent =
      String(objectCount)
  }

  private updateHistoryButtons(): void {
    this.undoButton.disabled = !this.customizer.canUndo()
    this.redoButton.disabled = !this.customizer.canRedo()
  }

  private localizeStatus(message: string): string {
    switch (message) {
      case 'Loading design':
        return this.labels.loadDesign
      case 'Design loaded':
        return this.labels.designLoaded
      case 'Loading product':
        return this.labels.loadProduct
      case 'Remote product ready':
      case 'Demo product ready':
        return this.labels.productReady
      case 'Undo complete':
        return this.labels.undoComplete
      case 'Redo complete':
        return this.labels.redoComplete
      default:
        return message
    }
  }

  private async runHistory(direction: 'undo' | 'redo'): Promise<void> {
    if (
      (direction === 'undo' && !this.customizer.canUndo()) ||
      (direction === 'redo' && !this.customizer.canRedo())
    ) {
      return
    }

    this.undoButton.disabled = true
    this.redoButton.disabled = true
    this.setStatus(direction === 'undo' ? this.labels.undo : this.labels.redo, 'busy')
    try {
      const changed = direction === 'undo'
        ? await this.customizer.undo()
        : await this.customizer.redo()
      if (changed) {
        this.setStatus(
          direction === 'undo'
            ? this.labels.undoComplete
            : this.labels.redoComplete,
        )
      }
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.updateHistoryButtons()
    }
  }

  private saveDesign(): void {
    try {
      downloadJson('customforge-design.json', this.customizer.saveDesign())
      this.setStatus(this.labels.designSaved)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    }
  }

  private exportTexture(): void {
    try {
      this.customizer.exportTexture()
      this.setStatus(this.labels.exportTexture)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    }
  }

  private renderTextFontOptions(): void {
    const fonts = new Set(DEFAULT_TEXT_FONTS)
    this.textPresets.forEach((preset) => fonts.add(preset.fontFamily))

    const mixed = document.createElement('option')
    mixed.value = ''
    mixed.textContent = '—'
    mixed.disabled = true
    this.textFontFamily.replaceChildren(
      mixed,
      ...Array.from(fonts).map((fontFamily) => {
        const option = document.createElement('option')
        option.value = fontFamily
        option.textContent = fontFamily
        option.style.fontFamily = fontFamily
        return option
      }),
    )
  }

  private ensureTextFontOption(fontFamily: string): void {
    if (
      Array.from(this.textFontFamily.options).some(
        (option) => option.value === fontFamily,
      )
    ) {
      return
    }
    const option = document.createElement('option')
    option.value = fontFamily
    option.textContent = fontFamily
    option.style.fontFamily = fontFamily
    this.textFontFamily.append(option)
  }

  private selectedTextObjects(): TextDesignObject[] | undefined {
    if (this.selectedObjectIds.size === 0) {
      return undefined
    }
    const selected = this.customizer.getObjects().filter((object) =>
      this.selectedObjectIds.has(object.id),
    )
    if (
      selected.length !== this.selectedObjectIds.size ||
      selected.some((object) => object.type !== 'text')
    ) {
      return undefined
    }
    return selected as TextDesignObject[]
  }

  private commonTextValue<T>(
    objects: TextDesignObject[],
    read: (object: TextDesignObject) => T,
  ): T | undefined {
    const first = read(objects[0])
    return objects.every((object) => Object.is(read(object), first))
      ? first
      : undefined
  }

  private updateTextToolbar(): void {
    const objects = this.selectedTextObjects()
    const visible =
      this.layout.toolbar &&
      this.features.textFormatting &&
      objects !== undefined &&
      objects.length > 0
    this.textToolbar.hidden = !visible
    if (!visible || !objects) {
      return
    }

    const locked = objects.some((object) => object.locked ?? false)
    this.textToolbar
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
        'input, select, button',
      )
      .forEach((control) => {
        control.disabled = locked
      })
    this.action('edit-text').disabled = locked || objects.length !== 1

    const fontFamily = this.commonTextValue(objects, (object) => object.fontFamily)
    if (fontFamily) {
      this.ensureTextFontOption(fontFamily)
    }
    this.textFontFamily.value = fontFamily ?? ''
    this.setNumberControl(
      this.textFontSize,
      this.commonTextValue(objects, (object) => object.fontSize),
    )
    this.setNumberControl(
      this.textLineHeight,
      this.commonTextValue(objects, (object) => object.lineHeight ?? 1.16),
    )
    this.setNumberControl(
      this.textLetterSpacing,
      this.commonTextValue(objects, (object) => object.charSpacing ?? 0),
    )

    const color = this.commonTextValue(objects, (object) => object.color)
    if (color) {
      this.setColorControl(this.textColor, color)
    }
    const backgroundColor = this.commonTextValue(
      objects,
      (object) => object.backgroundColor ?? '',
    )
    if (backgroundColor) {
      this.setColorControl(this.textBackgroundColor, backgroundColor)
    }

    this.setPressedState(
      '[data-text-style="bold"]',
      objects.map((object) => {
        const weight = object.fontWeight ?? 700
        return weight === 'bold' || (typeof weight === 'number' && weight >= 600)
      }),
    )
    this.setPressedState(
      '[data-text-style="italic"]',
      objects.map((object) => (object.fontStyle ?? 'normal') === 'italic'),
    )
    this.setPressedState(
      '[data-text-style="underline"]',
      objects.map((object) => object.underline ?? false),
    )
    this.setPressedState(
      '[data-action="toggle-text-background"]',
      objects.map((object) => Boolean(object.backgroundColor)),
    )

    for (const alignment of ['left', 'center', 'right'] as const) {
      this.setPressedState(
        `[data-text-align="${alignment}"]`,
        objects.map((object) => (object.textAlign ?? 'center') === alignment),
      )
    }
  }

  private setNumberControl(input: HTMLInputElement, value: number | undefined): void {
    input.value = value === undefined ? '' : String(value)
  }

  private setColorControl(input: HTMLInputElement, value: string): void {
    const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value)
    if (shortHex) {
      input.value = `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`
      return
    }
    if (/^#[\da-f]{6}$/i.test(value)) {
      input.value = value
    }
  }

  private setPressedState(selector: string, states: boolean[]): void {
    const button = requiredElement<HTMLButtonElement>(this.textToolbar, selector)
    const pressed = states.every(Boolean)
      ? 'true'
      : states.some(Boolean)
        ? 'mixed'
        : 'false'
    button.setAttribute('aria-pressed', pressed)
  }

  private updateSelectedText(options: UpdateTextOptions): void {
    const objects = this.selectedTextObjects()
    if (!objects) {
      return
    }

    try {
      objects.forEach((object) => this.customizer.updateText(object.id, options))
      this.updateTextToolbar()
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    }
  }

  private toggleSelectedTextStyle(
    style: 'bold' | 'italic' | 'underline',
  ): void {
    const objects = this.selectedTextObjects()
    if (!objects) {
      return
    }

    if (style === 'bold') {
      const enabled = objects.every((object) => {
        const weight = object.fontWeight ?? 700
        return weight === 'bold' || (typeof weight === 'number' && weight >= 600)
      })
      this.updateSelectedText({ fontWeight: enabled ? 'normal' : 'bold' })
    } else if (style === 'italic') {
      const enabled = objects.every(
        (object) => (object.fontStyle ?? 'normal') === 'italic',
      )
      this.updateSelectedText({ fontStyle: enabled ? 'normal' : 'italic' })
    } else {
      const enabled = objects.every((object) => object.underline ?? false)
      this.updateSelectedText({ underline: !enabled })
    }
  }

  private toggleSelectedTextBackground(): void {
    const objects = this.selectedTextObjects()
    if (!objects) {
      return
    }
    const enabled = objects.every((object) => Boolean(object.backgroundColor))
    this.updateSelectedText({
      backgroundColor: enabled ? null : this.textBackgroundColor.value,
    })
  }

  private renderLayers(force = false): void {
    const objects = this.customizer.getObjects()
    const signature = JSON.stringify({
      layers: objects.map((object) => [
        object.id,
        object.name,
        object.visible ?? true,
        object.locked ?? false,
        object.type === 'image' ? object.role : undefined,
      ]),
      selected: [...this.selectedObjectIds],
    })
    if (!force && signature === this.layerSignature) {
      this.updateObjectCount(objects.length)
      return
    }
    this.layerSignature = signature
    const backgroundCount = objects.filter(
      (object) => object.type === 'image' && object.role === 'background',
    ).length
    const items = objects
      .map((object, index) =>
        this.createLayerItem(object, index, objects.length, backgroundCount),
      )
      .reverse()
    if (items.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'customforge-workbench__layer-empty'
      empty.textContent = this.labels.noObjects
      items.push(empty)
    }
    this.layerList.replaceChildren(...items)
    this.updateObjectCount(objects.length)
    this.applyVisibility()
  }

  private createLayerItem(
    object: DesignObject,
    index: number,
    objectCount: number,
    backgroundCount: number,
  ): HTMLLIElement {
    const isBackground = object.type === 'image' && object.role === 'background'
    const typeLabel = object.type === 'text'
      ? this.labels.textObject
      : isBackground
        ? this.labels.backgroundObject
        : this.labels.imageObject
    const fallbackName = object.type === 'text'
      ? object.text || this.labels.textObject
      : typeLabel
    const item = document.createElement('li')
    item.className = 'customforge-workbench__layer-item'
    item.dataset.objectId = object.id
    item.dataset.visible = String(object.visible ?? true)
    item.dataset.locked = String(object.locked ?? false)
    item.dataset.selected = String(this.selectedObjectIds.has(object.id))
    item.dataset.role = isBackground ? 'background' : 'element'
    item.draggable = this.features.reorderObjects && !isBackground

    const selectButton = document.createElement('button')
    selectButton.className = 'customforge-workbench__layer-main'
    selectButton.type = 'button'
    selectButton.dataset.layerAction = 'select'
    selectButton.title = object.name || fallbackName
    selectButton.setAttribute('aria-label', object.name || fallbackName)

    const icon = document.createElement('i')
    icon.dataset.customforgeIcon = object.type === 'text' ? 'type' : 'image'
    icon.dataset.iconSlot = object.type === 'text'
      ? 'textObject'
      : isBackground
        ? 'backgroundObject'
        : 'imageObject'
    const copy = document.createElement('span')
    copy.className = 'customforge-workbench__layer-copy'
    const name = document.createElement('strong')
    name.textContent = object.name || fallbackName
    const type = document.createElement('span')
    type.textContent = typeLabel
    copy.append(name, type)
    selectButton.append(icon, copy)

    const actions = document.createElement('span')
    actions.className = 'customforge-workbench__layer-actions'
    actions.append(
      this.createLayerButton(
        'visibility',
        object.visible === false ? 'eye-off' : 'eye',
        object.visible === false ? 'showLayer' : 'hideLayer',
        object.visible === false ? this.labels.showLayer : this.labels.hideLayer,
        'toggleObjectVisibility',
      ),
      this.createLayerButton(
        'lock',
        object.locked ? 'lock' : 'lock-open',
        object.locked ? 'unlock' : 'lock',
        object.locked ? this.labels.unlockLayer : this.labels.lockLayer,
        'lockObjects',
      ),
      this.createLayerButton(
        'forward',
        'arrow-up',
        'moveForward',
        this.labels.moveLayerForward,
        'reorderObjects',
        isBackground || index === objectCount - 1,
      ),
      this.createLayerButton(
        'backward',
        'arrow-down',
        'moveBackward',
        this.labels.moveLayerBackward,
        'reorderObjects',
        isBackground || index <= backgroundCount,
      ),
      this.createLayerButton(
        'remove',
        'trash-2',
        'deleteSelection',
        this.labels.deleteLayer,
        'deleteSelection',
      ),
    )
    item.append(selectButton, actions)
    return item
  }

  private createLayerButton(
    action: string,
    iconName: string,
    iconSlot: string,
    title: string,
    feature: WorkbenchFeatureName,
    disabled = false,
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'customforge-workbench__layer-action'
    button.type = 'button'
    button.dataset.layerAction = action
    button.dataset.feature = feature
    button.title = title
    button.setAttribute('aria-label', title)
    button.disabled = disabled
    const icon = document.createElement('i')
    icon.dataset.customforgeIcon = iconName
    icon.dataset.iconSlot = iconSlot
    const label = document.createElement('span')
    label.className = 'customforge-workbench__icon-label'
    label.textContent = title
    button.append(icon, label)
    return button
  }

  private handleLayerAction(button: HTMLButtonElement): void {
    const item = button.closest<HTMLLIElement>('[data-object-id]')
    const id = item?.dataset.objectId
    if (!id) {
      return
    }

    const object = this.customizer.getObjects().find((entry) => entry.id === id)
    if (!object) {
      return
    }

    switch (button.dataset.layerAction) {
      case 'select':
        this.customizer.selectObject(id)
        break
      case 'visibility':
        this.customizer.setObjectVisibility(id, object.visible === false)
        break
      case 'lock':
        this.customizer.setObjectLocked(id, !object.locked)
        break
      case 'forward':
        this.moveLayerBy(id, 1)
        break
      case 'backward':
        this.moveLayerBy(id, -1)
        break
      case 'remove':
        this.customizer.removeObject(id)
        break
    }
  }

  private handleLayerRename(event: MouseEvent): void {
    if (!this.features.renameObjects) {
      return
    }
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-layer-action="select"]',
    )
    const item = button?.closest<HTMLLIElement>('[data-object-id]')
    const id = item?.dataset.objectId
    const object = id
      ? this.customizer.getObjects().find((entry) => entry.id === id)
      : undefined
    if (!button || !id || !object) {
      return
    }

    const input = document.createElement('input')
    input.className = 'customforge-workbench__layer-name-input'
    input.value = object.name || (object.type === 'text'
      ? object.text
      : object.role === 'background'
        ? this.labels.backgroundObject
        : this.labels.imageObject)
    input.maxLength = 80
    button.replaceWith(input)
    input.focus()
    input.select()

    let completed = false
    const finish = (save: boolean) => {
      if (completed) {
        return
      }
      completed = true
      if (save) {
        this.customizer.renameObject(id, input.value)
      }
      this.renderLayers(true)
    }
    input.addEventListener('blur', () => finish(true), { once: true })
    input.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault()
        finish(true)
      } else if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault()
        finish(false)
      }
    })
  }

  private moveLayerBy(id: string, offset: number): void {
    const objects = this.customizer.getObjects()
    const currentIndex = objects.findIndex((object) => object.id === id)
    if (currentIndex >= 0 && this.customizer.moveObject(id, currentIndex + offset)) {
      this.renderLayers(true)
    }
  }

  private handleLayerDragStart(event: DragEvent): void {
    const item = (event.target as Element).closest<HTMLLIElement>('[data-object-id]')
    if (!this.features.reorderObjects || item?.dataset.role === 'background') {
      event.preventDefault()
      return
    }
    this.draggedObjectId = item?.dataset.objectId
    if (!this.draggedObjectId) {
      event.preventDefault()
      return
    }
    item?.classList.add('is-dragging')
    event.dataTransfer?.setData('text/plain', this.draggedObjectId)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  private handleLayerDragOver(event: DragEvent): void {
    if (!this.draggedObjectId) {
      return
    }
    event.preventDefault()
    this.layerList
      .querySelectorAll('.is-drag-target')
      .forEach((item) => item.classList.remove('is-drag-target'))
    const target = (event.target as Element).closest<HTMLLIElement>(
      '[data-object-id]',
    )
    target?.classList.add('is-drag-target')
  }

  private handleLayerDrop(event: DragEvent): void {
    event.preventDefault()
    const targetId = (event.target as Element)
      .closest<HTMLLIElement>('[data-object-id]')
      ?.dataset.objectId
    const sourceId = this.draggedObjectId
    if (!sourceId || !targetId || sourceId === targetId) {
      this.clearLayerDragState()
      return
    }

    const objects = this.customizer.getObjects()
    const targetIndex = objects.findIndex((object) => object.id === targetId)
    if (targetIndex >= 0) {
      this.customizer.moveObject(sourceId, targetIndex)
    }
    this.clearLayerDragState()
    this.renderLayers(true)
  }

  private clearLayerDragState(): void {
    this.draggedObjectId = undefined
    this.layerList
      .querySelectorAll('.is-dragging, .is-drag-target')
      .forEach((item) => item.classList.remove('is-dragging', 'is-drag-target'))
  }

  private renderTextPresets(): void {
    const container = requiredElement(this.element, '[data-role="text-presets"]')
    const items = this.textPresets.map((preset) => {
      const button = document.createElement('button')
      button.className = 'customforge-workbench__text-preset'
      button.type = 'button'
      button.dataset.textPresetId = preset.id
      button.dataset.selected = String(preset.id === this.selectedTextPresetId)
      const preview = document.createElement('span')
      preview.className = 'customforge-workbench__text-preview'
      preview.dataset.previewFallback = preset.previewText ?? preset.name
      preview.textContent = preset.previewText ?? preset.name
      preview.style.fontFamily = preset.fontFamily
      preview.style.color = preset.color
      const name = document.createElement('strong')
      name.textContent = preset.name
      button.append(preview, name)
      return button
    })
    container.replaceChildren(...items)
    const fieldset = container.closest<HTMLFieldSetElement>('fieldset')
    if (fieldset) {
      fieldset.hidden = items.length === 0
    }
  }

  private openTextDialog(): void {
    const input = requiredElement<HTMLInputElement>(
      this.element,
      '[data-role="text-value"]',
    )
    input.value = this.labels.textInputPlaceholder
    this.selectedTextPresetId = this.textPresets[0]?.id
    if (this.selectedTextPresetId) {
      this.selectTextPreset(this.selectedTextPresetId)
    }
    this.updateTextPreviews()
    this.showDialog(this.textDialog)
    input.focus()
    input.select()
  }

  private selectTextPreset(id: string): void {
    const preset = this.textPresets.find((entry) => entry.id === id)
    if (!preset) {
      return
    }
    this.selectedTextPresetId = id
    requiredElement<HTMLInputElement>(this.element, '[data-role="text-color"]').value =
      preset.color
    this.element.querySelectorAll<HTMLElement>('[data-text-preset-id]').forEach(
      (button) => {
        button.dataset.selected = String(button.dataset.textPresetId === id)
      },
    )
    this.updateTextPreviews()
  }

  private updateTextPreviews(): void {
    const text = requiredElement<HTMLInputElement>(
      this.element,
      '[data-role="text-value"]',
    ).value
    const color = requiredElement<HTMLInputElement>(
      this.element,
      '[data-role="text-color"]',
    ).value
    this.element.querySelectorAll<HTMLElement>('.customforge-workbench__text-preview')
      .forEach((preview) => {
        const presetId = preview.closest<HTMLElement>('[data-text-preset-id]')
          ?.dataset.textPresetId
        const preset = this.textPresets.find((entry) => entry.id === presetId)
        preview.textContent = text || preview.dataset.previewFallback || ''
        preview.style.color = presetId === this.selectedTextPresetId
          ? color
          : preset?.color ?? ''
      })
  }

  private addTextFromDialog(event: SubmitEvent): void {
    event.preventDefault()
    const input = requiredElement<HTMLInputElement>(
      this.element,
      '[data-role="text-value"]',
    )
    input.setCustomValidity('')
    if (!this.textForm.reportValidity()) {
      return
    }
    const text = input.value.trim()
    if (!text) {
      input.setCustomValidity(this.labels.textInputLabel)
      input.reportValidity()
      return
    }
    const color = requiredElement<HTMLInputElement>(
      this.element,
      '[data-role="text-color"]',
    ).value
    const preset = this.textPresets.find(
      (entry) => entry.id === this.selectedTextPresetId,
    )
    this.customizer.addText({
      text,
      name: text.slice(0, 48),
      color,
      ...(preset
        ? {
            fontFamily: preset.fontFamily,
            fontSize: preset.fontSize,
            width: preset.width,
          }
        : {}),
    })
    this.closeDialog(this.textDialog)
    this.setStatus(this.labels.addTextConfirm)
  }

  private renderAssetPresets(): void {
    this.renderAssetGroup('background-presets', this.backgrounds, 'background')
    this.renderAssetGroup('element-presets', this.elements, 'element')
  }

  private renderAssetGroup(
    roleName: string,
    assets: WorkbenchAsset[],
    role: DesignImageRole,
  ): void {
    const container = requiredElement(this.element, `[data-role="${roleName}"]`)
    if (assets.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'customforge-workbench__preset-empty'
      empty.textContent = this.labels.noPresetAssets
      container.replaceChildren(empty)
      return
    }
    container.replaceChildren(
      ...assets.map((asset) => {
        const button = document.createElement('button')
        button.className = 'customforge-workbench__asset-preset'
        button.type = 'button'
        button.dataset.assetId = asset.id
        button.dataset.assetRole = role
        button.dataset.selected = 'false'
        const image = document.createElement('img')
        image.src = asset.thumbnailUrl ?? asset.url
        image.alt = asset.alt ?? asset.name
        image.loading = 'lazy'
        const name = document.createElement('strong')
        name.textContent = asset.name
        button.append(image, name)
        return button
      }),
    )
  }

  private openImageDialog(): void {
    this.resetImageSelection()
    this.setImageTab('upload')
    this.showDialog(this.imageDialog)
  }

  private setImageTab(tab: ImageTab): void {
    const next = tab === 'backgrounds' && !this.features.presetBackgrounds
      ? 'upload'
      : tab === 'elements' && !this.features.presetElements
        ? 'upload'
        : tab
    if (this.activeImageTab !== next && this.selectedImage) {
      this.resetImageSelection()
    }
    this.activeImageTab = next
    this.element.querySelectorAll<HTMLButtonElement>('[data-image-tab]').forEach(
      (button) => {
        const selected = button.dataset.imageTab === next
        button.dataset.selected = String(selected)
        button.setAttribute('aria-selected', String(selected))
        button.tabIndex = selected ? 0 : -1
      },
    )
    this.element.querySelectorAll<HTMLElement>('[data-image-panel]').forEach(
      (panel) => {
        panel.hidden = panel.dataset.imagePanel !== next
      },
    )
  }

  private selectUploadedImage(): void {
    const file = this.imageInput.files?.[0]
    if (!file) {
      return
    }
    this.releaseImageSelection()
    const objectUrl = URL.createObjectURL(file)
    this.selectedImage = {
      src: objectUrl,
      name: file.name.replace(/\.[^.]+$/, '') || this.labels.imageObject,
      role: 'element',
      objectUrl,
    }
    requiredElement(this.element, '[data-role="image-file-name"]').textContent =
      file.name
    const preview = requiredElement<HTMLImageElement>(
      this.element,
      '[data-role="image-preview"]',
    )
    preview.src = objectUrl
    preview.alt = file.name
    preview.hidden = false
    this.imageSubmitButton.disabled = false
  }

  private selectPresetAsset(id: string, role: DesignImageRole): void {
    const assets = role === 'background' ? this.backgrounds : this.elements
    const asset = assets.find((entry) => entry.id === id)
    if (!asset) {
      return
    }
    this.releaseImageSelection()
    this.selectedImage = { src: asset.url, name: asset.name, role }
    this.element.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((button) => {
      button.dataset.selected = String(
        button.dataset.assetId === id && button.dataset.assetRole === role,
      )
    })
    this.imageSubmitButton.disabled = false
  }

  private async addImageFromDialog(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const selection = this.selectedImage
    if (!selection) {
      return
    }

    this.imageSubmitButton.disabled = true
    this.setStatus(this.labels.addImage, 'busy')
    try {
      await this.customizer.addImage({
        src: selection.src,
        name: selection.name,
        role: selection.role,
      })
      this.closeDialog(this.imageDialog)
      this.setStatus(this.labels.addImageConfirm)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
      this.imageSubmitButton.disabled = false
    }
  }

  private resetImageSelection(): void {
    this.releaseImageSelection()
    this.selectedImage = undefined
    this.imageInput.value = ''
    requiredElement(this.element, '[data-role="image-file-name"]').textContent =
      this.labels.noImageSelected
    const preview = requiredElement<HTMLImageElement>(
      this.element,
      '[data-role="image-preview"]',
    )
    preview.removeAttribute('src')
    preview.alt = ''
    preview.hidden = true
    this.element.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((button) => {
      button.dataset.selected = 'false'
    })
    this.imageSubmitButton.disabled = true
  }

  private releaseImageSelection(): void {
    if (this.selectedImage?.objectUrl) {
      URL.revokeObjectURL(this.selectedImage.objectUrl)
    }
  }

  private async loadSelectedDesign(): Promise<void> {
    const file = this.designInput.files?.[0]
    if (!file) {
      return
    }

    this.loadDesignButton.disabled = true
    this.setStatus(this.labels.loadDesign, 'busy')
    try {
      await this.customizer.loadDesign(JSON.parse(await file.text()))
      this.setStatus(this.labels.designLoaded)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.loadDesignButton.disabled = false
      this.designInput.value = ''
    }
  }

  private async loadDemoProduct(): Promise<void> {
    this.submitProductButton.disabled = true
    this.setStatus(this.labels.loadProduct, 'busy')
    try {
      await this.customizer.loadProduct({})
      this.closeDialog(this.productDialog)
      this.setStatus(this.labels.productReady)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.submitProductButton.disabled = false
    }
  }

  private async loadRemoteProduct(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!this.remoteForm.reportValidity()) {
      return
    }

    this.submitProductButton.disabled = true
    this.setStatus(this.labels.loadProduct, 'busy')
    try {
      await this.customizer.loadProduct({
        modelUrl: requiredElement<HTMLInputElement>(
          this.element,
          '[data-role="model-url"]',
        ).value,
        textureUrl: requiredElement<HTMLInputElement>(
          this.element,
          '[data-role="texture-url"]',
        ).value,
        surfaceMesh: requiredElement<HTMLInputElement>(
          this.element,
          '[data-role="mesh-name"]',
        ).value,
        textureFlipY: requiredElement<HTMLInputElement>(
          this.element,
          '[data-role="flip-texture"]',
        ).checked,
      })
      this.closeDialog(this.productDialog)
      this.setStatus(this.labels.productReady)
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.submitProductButton.disabled = false
    }
  }
}
