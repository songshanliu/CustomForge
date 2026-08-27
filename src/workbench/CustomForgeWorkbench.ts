import {
  ArrowDown,
  ArrowUp,
  Box,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  Link2,
  Lock,
  LockOpen,
  RotateCcw,
  Save,
  Trash2,
  Type,
  Upload,
  X,
  createIcons,
} from 'lucide'
import { resolveElement } from '../core/dom'
import type { DesignObject } from '../core/types'
import { ProductCustomizer } from '../customizer/ProductCustomizer'
import { normalizeWorkbenchOptions } from './config'
import { createWorkbenchElement } from './template'
import type {
  WorkbenchFeatureName,
  WorkbenchFeatures,
  WorkbenchLayout,
  WorkbenchLayoutName,
  WorkbenchOptions,
  WorkbenchStatusMode,
} from './types'

const toolbarFeatures: WorkbenchFeatureName[] = [
  'addText',
  'addImage',
  'saveDesign',
  'loadDesign',
  'deleteSelection',
]

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

function renderIcons(): void {
  createIcons({
    nameAttr: 'data-customforge-icon',
    icons: {
      ArrowDown,
      ArrowUp,
      Box,
      Download,
      Eye,
      EyeOff,
      FolderOpen,
      Image: ImageIcon,
      ImagePlus,
      Layers3,
      Link2,
      Lock,
      LockOpen,
      RotateCcw,
      Save,
      Trash2,
      Type,
      Upload,
      X,
    },
    attrs: {
      width: 18,
      height: 18,
      'stroke-width': 1.8,
    },
  })
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
  private readonly unsubscribe: Array<() => void> = []
  private readonly features: WorkbenchFeatures
  private readonly layout: WorkbenchLayout
  private readonly layerList: HTMLOListElement
  private readonly deleteButton: HTMLButtonElement
  private readonly statusLabel: HTMLElement
  private readonly objectCountLabel: HTMLElement
  private readonly imageInput: HTMLInputElement
  private readonly designInput: HTMLInputElement
  private readonly loadDesignButton: HTMLButtonElement
  private readonly dialog: HTMLDialogElement
  private readonly remoteForm: HTMLFormElement
  private readonly submitProductButton: HTMLButtonElement
  private selectedObjectIds = new Set<string>()
  private layerSignature = ''
  private draggedObjectId?: string
  private destroyed = false

  private constructor(
    host: HTMLElement,
    element: HTMLElement,
    customizer: ProductCustomizer,
    features: WorkbenchFeatures,
    layout: WorkbenchLayout,
  ) {
    this.host = host
    this.element = element
    this.customizer = customizer
    this.features = features
    this.layout = layout
    this.layerList = requiredElement<HTMLOListElement>(
      element,
      '[data-role="layer-list"]',
    )
    this.deleteButton = requiredElement<HTMLButtonElement>(
      element,
      '[data-action="delete-selection"]',
    )
    this.statusLabel = requiredElement(element, '[data-role="status-label"]')
    this.objectCountLabel = requiredElement(element, '[data-role="object-count"]')
    this.imageInput = requiredElement<HTMLInputElement>(
      element,
      '[data-role="image-input"]',
    )
    this.designInput = requiredElement<HTMLInputElement>(
      element,
      '[data-role="design-input"]',
    )
    this.loadDesignButton = requiredElement<HTMLButtonElement>(
      element,
      '[data-action="load-design"]',
    )
    this.dialog = requiredElement<HTMLDialogElement>(
      element,
      '[data-role="load-dialog"]',
    )
    this.remoteForm = requiredElement<HTMLFormElement>(
      element,
      '[data-role="remote-form"]',
    )
    this.submitProductButton = requiredElement<HTMLButtonElement>(
      element,
      '[data-action="submit-product"]',
    )
    this.bindEvents()
    this.applyVisibility()
    this.renderLayers(true)
    this.setStatus('Product ready')
  }

  /**
   * 创建 Workbench 并完成底层定制器初始化
   *
   * @param options 挂载容器、产品资源、功能和布局开关
   * @returns 初始化完成的 Workbench
   * @throws 挂载容器无效或产品初始化失败时清理已创建界面并继续抛出错误
   */
  static async create(options: WorkbenchOptions): Promise<CustomForgeWorkbench> {
    const host = resolveElement(options.container, 'Workbench')
    const normalized = normalizeWorkbenchOptions(options)
    const element = createWorkbenchElement()
    requiredElement(element, '[data-role="brand-title"]').textContent =
      normalized.brandTitle
    requiredElement(element, '[data-role="brand-subtitle"]').textContent =
      normalized.brandSubtitle
    requiredElement(element, '[data-role="resolution"]').textContent =
      `${normalized.editorWidth} x ${normalized.editorHeight}`
    host.replaceChildren(element)
    renderIcons()

    try {
      const customizer = await ProductCustomizer.create({
        editor: requiredElement(element, '[data-role="editor-host"]'),
        viewer: requiredElement(element, '[data-role="viewer-host"]'),
        editorWidth: normalized.editorWidth,
        editorHeight: normalized.editorHeight,
        product: normalized.product,
      })
      return new CustomForgeWorkbench(
        host,
        element,
        customizer,
        normalized.features,
        normalized.layout,
      )
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
    if (feature === 'loadRemoteProduct' && !enabled && this.dialog.open) {
      this.dialog.close()
    }
    this.applyVisibility()
    this.renderLayers(true)
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
      }),
      this.customizer.on('selectionchange', ({ objectIds }) => {
        this.selectedObjectIds = new Set(objectIds)
        this.deleteButton.disabled = objectIds.length === 0
        this.renderLayers()
      }),
      this.customizer.on('status', ({ message }) => this.setStatus(message)),
      this.customizer.on('error', ({ error }) =>
        this.setStatus(error.message, 'error'),
      ),
    )

    this.action('add-text').addEventListener(
      'click',
      () => this.customizer.addText(),
      { signal },
    )
    this.action('add-image').addEventListener(
      'click',
      () => this.imageInput.click(),
      { signal },
    )
    this.action('save-design').addEventListener(
      'click',
      () => {
        try {
          downloadJson('customforge-design.json', this.customizer.saveDesign())
          this.setStatus('Design saved')
        } catch (error) {
          this.setStatus(errorMessage(error), 'error')
        }
      },
      { signal },
    )
    this.loadDesignButton.addEventListener(
      'click',
      () => this.designInput.click(),
      { signal },
    )
    this.deleteButton.addEventListener(
      'click',
      () => this.customizer.deleteSelected(),
      { signal },
    )
    this.action('reset-view').addEventListener(
      'click',
      () => this.customizer.resetView(),
      { signal },
    )
    this.action('export-texture').addEventListener(
      'click',
      () => {
        try {
          this.customizer.exportTexture()
          this.setStatus('Texture exported')
        } catch {
          this.setStatus('Export blocked by remote asset CORS', 'error')
        }
      },
      { signal },
    )
    this.action('load-remote').addEventListener(
      'click',
      () => this.dialog.showModal(),
      { signal },
    )
    this.action('close-dialog').addEventListener(
      'click',
      () => this.dialog.close(),
      { signal },
    )
    this.action('use-demo').addEventListener(
      'click',
      () => void this.loadDemoProduct(),
      { signal },
    )

    this.imageInput.addEventListener(
      'change',
      () => void this.loadSelectedImage(),
      { signal },
    )
    this.designInput.addEventListener(
      'change',
      () => void this.loadSelectedDesign(),
      { signal },
    )
    this.remoteForm.addEventListener(
      'submit',
      (event) => void this.loadRemoteProduct(event),
      { signal },
    )
    this.layerList.addEventListener(
      'click',
      (event) => this.handleLayerAction(event),
      { signal },
    )
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

  private action(name: string): HTMLButtonElement {
    return requiredElement(this.element, `[data-action="${name}"]`)
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

    const toolbar = requiredElement<HTMLElement>(
      this.element,
      '[data-layout="toolbar"]',
    )
    toolbar.hidden =
      !this.layout.toolbar ||
      !toolbarFeatures.some((feature) => this.features[feature])
    this.element.dataset.layers = this.layout.layers ? 'visible' : 'hidden'

    const documentSeparator = requiredElement<HTMLElement>(
      this.element,
      '[data-tool-group="design-document"]',
    )
    documentSeparator.hidden =
      !this.features.saveDesign && !this.features.loadDesign
    const selectionSeparator = requiredElement<HTMLElement>(
      this.element,
      '[data-tool-group="selection"]',
    )
    selectionSeparator.hidden = !this.features.deleteSelection
  }

  private updateObjectCount(objectCount: number): void {
    this.objectCountLabel.textContent =
      `${objectCount} object${objectCount === 1 ? '' : 's'}`
    requiredElement(this.element, '[data-role="layer-count"]').textContent =
      String(objectCount)
  }

  private renderLayers(force = false): void {
    const objects = this.customizer.getObjects()
    const signature = JSON.stringify({
      layers: objects.map((object) => [
        object.id,
        object.name,
        object.visible ?? true,
        object.locked ?? false,
      ]),
      selected: [...this.selectedObjectIds],
    })
    if (!force && signature === this.layerSignature) {
      this.updateObjectCount(objects.length)
      return
    }
    this.layerSignature = signature
    this.layerList.replaceChildren(
      ...objects
        .map((object, index) => this.createLayerItem(object, index, objects.length))
        .reverse(),
    )
    this.updateObjectCount(objects.length)
    this.applyVisibility()
    renderIcons()
  }

  private createLayerItem(
    object: DesignObject,
    index: number,
    objectCount: number,
  ): HTMLLIElement {
    const item = document.createElement('li')
    item.className = 'customforge-workbench__layer-item'
    item.dataset.objectId = object.id
    item.dataset.visible = String(object.visible ?? true)
    item.dataset.locked = String(object.locked ?? false)
    item.dataset.selected = String(this.selectedObjectIds.has(object.id))
    item.draggable = this.features.reorderObjects

    const selectButton = document.createElement('button')
    selectButton.className = 'customforge-workbench__layer-main'
    selectButton.type = 'button'
    selectButton.dataset.layerAction = 'select'
    selectButton.title = this.features.renameObjects
      ? 'Select layer, double-click to rename'
      : 'Select layer'

    const icon = document.createElement('i')
    icon.dataset.customforgeIcon = object.type === 'text' ? 'type' : 'image'
    const copy = document.createElement('span')
    copy.className = 'customforge-workbench__layer-copy'
    const name = document.createElement('strong')
    name.textContent = object.name || (object.type === 'text' ? object.text : 'Image')
    const type = document.createElement('span')
    type.textContent = object.type === 'text' ? 'Text' : 'Image'
    copy.append(name, type)
    selectButton.append(icon, copy)

    const actions = document.createElement('span')
    actions.className = 'customforge-workbench__layer-actions'
    actions.append(
      this.createLayerButton(
        'visibility',
        object.visible === false ? 'eye-off' : 'eye',
        object.visible === false ? 'Show layer' : 'Hide layer',
        'toggleObjectVisibility',
      ),
      this.createLayerButton(
        'lock',
        object.locked ? 'lock' : 'lock-open',
        object.locked ? 'Unlock layer' : 'Lock layer',
        'lockObjects',
      ),
      this.createLayerButton(
        'forward',
        'arrow-up',
        'Move layer forward',
        'reorderObjects',
        index === objectCount - 1,
      ),
      this.createLayerButton(
        'backward',
        'arrow-down',
        'Move layer backward',
        'reorderObjects',
        index === 0,
      ),
      this.createLayerButton(
        'remove',
        'trash-2',
        'Delete layer',
        'deleteSelection',
      ),
    )
    item.append(selectButton, actions)
    return item
  }

  private createLayerButton(
    action: string,
    iconName: string,
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
    button.append(icon)
    return button
  }

  private handleLayerAction(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-layer-action]',
    )
    const item = button?.closest<HTMLLIElement>('[data-object-id]')
    const id = item?.dataset.objectId
    if (!button || !id) {
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

  private handleLayerRename(event: Event): void {
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
    input.value = object.name || (object.type === 'text' ? object.text : 'Image')
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
      this.renderLayers()
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
      this.renderLayers()
    }
  }

  private handleLayerDragStart(event: DragEvent): void {
    if (!this.features.reorderObjects) {
      event.preventDefault()
      return
    }
    const item = (event.target as Element).closest<HTMLLIElement>('[data-object-id]')
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
    this.renderLayers()
  }

  private clearLayerDragState(): void {
    this.draggedObjectId = undefined
    this.layerList
      .querySelectorAll('.is-dragging, .is-drag-target')
      .forEach((item) => item.classList.remove('is-dragging', 'is-drag-target'))
  }

  private async loadSelectedImage(): Promise<void> {
    const file = this.imageInput.files?.[0]
    if (!file) {
      return
    }

    const objectUrl = URL.createObjectURL(file)
    this.setStatus('Loading image', 'busy')
    try {
      await this.customizer.addImage({ src: objectUrl })
      this.setStatus('Image added')
    } catch {
      this.setStatus('Image could not be loaded', 'error')
    } finally {
      URL.revokeObjectURL(objectUrl)
      this.imageInput.value = ''
    }
  }

  private async loadSelectedDesign(): Promise<void> {
    const file = this.designInput.files?.[0]
    if (!file) {
      return
    }

    this.loadDesignButton.disabled = true
    this.setStatus('Loading design', 'busy')
    try {
      await this.customizer.loadDesign(JSON.parse(await file.text()))
      this.setStatus('Design loaded')
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.loadDesignButton.disabled = false
      this.designInput.value = ''
    }
  }

  private async loadDemoProduct(): Promise<void> {
    this.submitProductButton.disabled = true
    this.setStatus('Loading demo', 'busy')
    try {
      await this.customizer.loadProduct({})
      this.dialog.close()
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
    this.setStatus('Loading remote product', 'busy')
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
      this.dialog.close()
    } catch (error) {
      this.setStatus(errorMessage(error), 'error')
    } finally {
      this.submitProductButton.disabled = false
    }
  }
}
