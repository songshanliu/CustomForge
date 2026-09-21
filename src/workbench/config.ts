import defaultLogoUrl from './assets/CustomForgeLogo.png'
import { builtInAssetLibrary } from './assets/catalog'
import type {
  WorkbenchAsset,
  WorkbenchBranding,
  WorkbenchExtensionButton,
  WorkbenchExtensionPlacement,
  WorkbenchExtensionPredicate,
  WorkbenchExtensionVariant,
  WorkbenchFeatures,
  WorkbenchFontFamily,
  WorkbenchIconConfiguration,
  WorkbenchLabels,
  WorkbenchLayout,
  WorkbenchOptions,
  WorkbenchTextPreset,
  WorkbenchTheme,
} from './types'

/** Workbench 内部使用的完整品牌配置 */
export interface NormalizedWorkbenchBranding {
  /** 品牌 Logo 地址 */
  logoUrl: string

  /** 品牌 Logo 替代文字 */
  logoAlt: string

  /** 是否显示品牌 Logo */
  showLogo: boolean

  /** 品牌标题 */
  title: string

  /** 是否显示品牌标题 */
  showTitle: boolean

  /** 品牌副标题 */
  subtitle: string

  /** 是否显示品牌副标题 */
  showSubtitle: boolean
}

/** Workbench 内部使用的完整配置 */
export interface NormalizedWorkbenchOptions {
  /** 添加到 Workbench 根元素的 CSS 类名 */
  classNames: string[]

  /** 二维编辑画布的逻辑宽度 */
  editorWidth: number

  /** 二维编辑画布的逻辑高度 */
  editorHeight: number

  /** 最多保留的撤销步骤数量 */
  historyLimit: number

  /** 初始化产品配置 */
  product: WorkbenchOptions['product']

  /** 二维编辑器与三维查看器外观配置 */
  appearance: WorkbenchOptions['appearance']

  /** 完整功能开关 */
  features: WorkbenchFeatures

  /** 完整布局开关 */
  layout: WorkbenchLayout

  /** 完整品牌配置 */
  branding: NormalizedWorkbenchBranding

  /** 完整界面文案 */
  labels: WorkbenchLabels

  /** 完整主题配置 */
  theme: WorkbenchTheme

  /** 完整图标配置 */
  icons: Required<WorkbenchIconConfiguration>

  /** 可用文字排版预设 */
  textPresets: WorkbenchTextPreset[]

  /** 字体选择器条目 */
  fontFamilies: WorkbenchFontFamily[]

  /** 可用背景素材 */
  backgrounds: WorkbenchAsset[]

  /** 可用装饰元素 */
  elements: WorkbenchAsset[]

  /** 完成校验和默认值补全的扩展按钮 */
  extensions: NormalizedWorkbenchExtensionButton[]

  /** 用户可见异常文案格式化函数 */
  formatError: NonNullable<WorkbenchOptions['formatError']>
}

/** Workbench 内部使用的完整扩展按钮配置 */
export interface NormalizedWorkbenchExtensionButton
  extends Omit<
    WorkbenchExtensionButton,
    | 'className'
    | 'iconUrl'
    | 'showLabel'
    | 'variant'
    | 'order'
    | 'visible'
    | 'disabled'
  > {
  /** 清理空白后的可选图标地址 */
  iconUrl?: string

  /** 是否在图标旁显示文案 */
  showLabel: boolean

  /** 按钮视觉语义 */
  variant: WorkbenchExtensionVariant

  /** 同一位置内的升序排列值 */
  order: number

  /** 添加到按钮元素的宿主 CSS 类名 */
  classNames: string[]

  /** 固定或动态可见条件 */
  visible: boolean | WorkbenchExtensionPredicate

  /** 固定或动态禁用条件 */
  disabled: boolean | WorkbenchExtensionPredicate
}

const defaultFeatures: WorkbenchFeatures = {
  addText: true,
  textFormatting: true,
  addImage: true,
  undoRedo: true,
  deleteSelection: true,
  saveDesign: true,
  loadDesign: true,
  loadRemoteProduct: true,
  resetView: true,
  reorderObjects: true,
  toggleObjectVisibility: true,
  lockObjects: true,
  renameObjects: true,
  presetBackgrounds: true,
  presetElements: true,
}

const defaultLayout: WorkbenchLayout = {
  header: true,
  editorHeader: true,
  viewerHeader: true,
  toolbar: true,
  layers: true,
  status: true,
}

const defaultLabels: WorkbenchLabels = {
  workbench: 'Product customization studio',
  editorTitle: 'Design surface',
  viewerTitle: 'Product preview',
  editorMode: '2D',
  viewerMode: '3D',
  editorCanvas: 'UV texture editor',
  viewerCanvas: 'Interactive 3D product preview',
  layers: 'Layers',
  noObjects: 'No design objects',
  addText: 'Text',
  textFormatting: 'Text formatting',
  moreTextOptions: 'More text options',
  editText: 'Edit text',
  fontFamily: 'Font',
  fontSize: 'Font size',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  textBackground: 'Text highlight',
  lineHeight: 'Line height',
  letterSpacing: 'Letter spacing',
  addImage: 'Image',
  setImageAsBackground: 'Set as background',
  undo: 'Undo',
  redo: 'Redo',
  saveDesign: 'Save design JSON',
  loadDesign: 'Open design JSON',
  deleteSelection: 'Delete selected object',
  loadProduct: 'Load product',
  resetView: 'Reset 3D view',
  textObject: 'Text',
  imageObject: 'Image',
  backgroundObject: 'Background',
  showLayer: 'Show layer',
  hideLayer: 'Hide layer',
  lockLayer: 'Lock layer',
  unlockLayer: 'Unlock layer',
  moveLayerForward: 'Move layer forward',
  moveLayerBackward: 'Move layer backward',
  deleteLayer: 'Delete layer',
  textDialogEyebrow: 'Typography',
  textDialogTitle: 'Add text',
  textInputLabel: 'Text',
  textInputPlaceholder: 'Make it yours',
  defaultText: 'Edit this text',
  textRequired: 'Enter text',
  textPresets: 'Style',
  textColor: 'Color',
  colorBlack: 'Black',
  colorSlate: 'Slate',
  colorGray: 'Gray',
  colorWhite: 'White',
  colorRed: 'Red',
  colorOrange: 'Orange',
  colorYellow: 'Yellow',
  colorGreen: 'Green',
  colorTeal: 'Teal',
  colorCyan: 'Cyan',
  colorBlue: 'Blue',
  colorPurple: 'Purple',
  colorPink: 'Pink',
  colorBrown: 'Brown',
  mixedValue: '—',
  addTextConfirm: 'Add text',
  imageDialogEyebrow: 'Artwork',
  imageDialogTitle: 'Add image',
  uploadImageTab: 'Upload',
  backgroundsTab: 'Backgrounds',
  elementsTab: 'Elements',
  chooseImage: 'Choose image',
  noImageSelected: 'No image selected',
  noPresetAssets: 'No preset assets',
  addImageConfirm: 'Add image',
  close: 'Close',
  cancel: 'Cancel',
  productDialogEyebrow: 'Product source',
  productDialogTitle: 'Load product',
  productSourceMethod: 'Model source',
  productFileSource: 'Upload GLB',
  productUrlSource: 'From URL',
  modelFile: 'GLB file',
  chooseModelFile: 'Choose GLB file',
  noModelFileSelected: 'No file selected',
  invalidModelFile: 'Choose a .glb file',
  modelFileRequired: 'Choose a GLB file',
  modelUrl: 'GLB or GLTF URL',
  modelUrlPlaceholder: 'https://example.com/product.glb',
  modelUrlRequired: 'Enter a model URL',
  invalidModelUrl: 'Enter a valid model URL',
  advancedProductOptions: 'Advanced options',
  textureUrl: 'Base artwork URL (optional)',
  textureUrlPlaceholder: 'https://example.com/artwork.png',
  invalidTextureUrl: 'Enter a valid artwork URL',
  textureUrlHint: 'Placed beneath all editable objects',
  surfaceMesh: 'Printable mesh name',
  surfaceMeshRequired: 'Enter a printable mesh name',
  surfaceMeshHint: 'The model mesh that receives the design; defaults to PrintArea',
  flipTexture: 'Flip texture vertically',
  flipTextureHint: 'Only enable this when the design appears upside down',
  useDemo: 'Use built-in demo',
  addingImage: 'Adding image',
  loadingDesign: 'Loading design',
  loadingProduct: 'Loading product...',
  undoing: 'Undoing',
  redoing: 'Redoing',
  starting: 'Starting',
  productReady: 'Product ready',
  designSaved: 'Design saved',
  textAdded: 'Text added',
  imageAdded: 'Image added',
  designLoaded: 'Design loaded',
  undoComplete: 'Undo complete',
  redoComplete: 'Redo complete',
  objectCountOne: '{count} object',
  objectCountMany: '{count} objects',
  designFilename: 'customforge-design.json',
}

const defaultTheme: WorkbenchTheme = {
  ink: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  stage: '#f4f4f5',
  accent: '#268a4b',
  accentHover: '#1f7640',
  accentContrast: '#ffffff',
  danger: '#b42318',
  fontFamily:
    '"Nunito Sans", "Avenir Next", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
  controlRadius: '4px',
}

const defaultTextPresets: WorkbenchTextPreset[] = [
  {
    id: 'modern-bold',
    name: 'Modern bold',
    previewText: 'CustomForge',
    fontFamily: 'Arial',
    fontSize: 22,
    width: 220,
    color: '#17191c',
  },
  {
    id: 'editorial-serif',
    name: 'Editorial serif',
    previewText: 'Made for you',
    fontFamily: 'Georgia',
    fontSize: 64,
    width: 480,
    color: '#1f2933',
  },
  {
    id: 'clean-label',
    name: 'Clean label',
    previewText: 'CUSTOM EDITION',
    fontFamily: 'Trebuchet MS',
    fontSize: 52,
    width: 420,
    color: '#0b66c3',
  },
  {
    id: 'signature',
    name: 'Signature',
    previewText: 'Yours truly',
    fontFamily: 'Brush Script MT',
    fontSize: 76,
    width: 440,
    color: '#7a3e2f',
  },
]

const defaultFontFamilies: WorkbenchFontFamily[] = [
  'Arial',
  'Georgia',
  'Trebuchet MS',
  'Verdana',
  'Times New Roman',
  'Courier New',
  'Brush Script MT',
  'Nunito Sans',
].map((fontFamily) => ({ value: fontFamily, label: fontFamily }))

function defaultErrorFormatter(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return resolved
}

function uniqueAssets(assets: WorkbenchAsset[], name: string): WorkbenchAsset[] {
  const ids = new Set<string>()
  return assets.map((asset) => {
    const id = asset.id.trim()
    const label = asset.name.trim()
    const url = asset.url.trim()
    if (!id || !label || !url) {
      throw new TypeError(`${name} assets require id, name, and url`)
    }
    if (ids.has(id)) {
      throw new TypeError(`${name} asset id is duplicated: ${id}`)
    }
    ids.add(id)
    return { ...asset, id, name: label, url }
  })
}

function uniqueTextPresets(presets: WorkbenchTextPreset[]): WorkbenchTextPreset[] {
  const ids = new Set<string>()
  return presets.map((preset) => {
    const id = preset.id.trim()
    const name = preset.name.trim()
    if (!id || !name || !preset.fontFamily.trim()) {
      throw new TypeError('Text presets require id, name, and fontFamily')
    }
    if (ids.has(id)) {
      throw new TypeError(`Text preset id is duplicated: ${id}`)
    }
    if (preset.fontSize <= 0 || preset.width <= 0) {
      throw new RangeError(`Text preset ${id} requires positive fontSize and width`)
    }
    ids.add(id)
    return { ...preset, id, name, fontFamily: preset.fontFamily.trim() }
  })
}

function normalizeClassNames(value?: string): string[] {
  return [...new Set(value?.trim().split(/\s+/).filter(Boolean) ?? [])]
}

const extensionPlacements = new Set<WorkbenchExtensionPlacement>([
  'globalActions',
  'editorToolbar',
  'selectionToolbar',
  'layerActions',
])

const extensionVariants = new Set<WorkbenchExtensionVariant>([
  'primary',
  'secondary',
  'plain',
  'danger',
])

function normalizeExtensionPredicate(
  value: boolean | WorkbenchExtensionPredicate | undefined,
  fallback: boolean,
  field: 'visible' | 'disabled',
): boolean | WorkbenchExtensionPredicate {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'boolean' && typeof value !== 'function') {
    throw new TypeError(`Extension ${field} must be a boolean or function`)
  }
  return value
}

/**
 * 校验并补全单个 Workbench 扩展按钮配置
 *
 * @param extension 外部扩展按钮配置
 * @returns 可直接渲染的内部配置
 */
export function normalizeWorkbenchExtension(
  extension: WorkbenchExtensionButton,
): NormalizedWorkbenchExtensionButton {
  const id = extension.id.trim()
  const label = extension.label.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new TypeError(
      'Extension id must start with an alphanumeric character and contain only letters, numbers, dots, underscores, or hyphens',
    )
  }
  if (!extensionPlacements.has(extension.placement)) {
    throw new TypeError(`Extension ${id} has an invalid placement`)
  }
  if (!label) {
    throw new TypeError(`Extension ${id} requires a label`)
  }
  if (typeof extension.onClick !== 'function') {
    throw new TypeError(`Extension ${id} requires an onClick function`)
  }

  const iconUrl = extension.iconUrl?.trim() || undefined
  const showLabel = extension.showLabel ??
    (extension.placement !== 'layerActions' || iconUrl === undefined)
  if (!showLabel && !iconUrl) {
    throw new TypeError(
      `Extension ${id} must provide iconUrl when showLabel is false`,
    )
  }

  const variant = extension.variant ??
    (extension.placement === 'globalActions' ? 'secondary' : 'plain')
  if (!extensionVariants.has(variant)) {
    throw new TypeError(`Extension ${id} has an invalid variant`)
  }

  const order = extension.order ?? 0
  if (!Number.isFinite(order)) {
    throw new TypeError(`Extension ${id} order must be a finite number`)
  }

  return {
    id,
    placement: extension.placement,
    label,
    iconUrl,
    showLabel,
    variant,
    order,
    classNames: normalizeClassNames(extension.className),
    visible: normalizeExtensionPredicate(extension.visible, true, 'visible'),
    disabled: normalizeExtensionPredicate(extension.disabled, false, 'disabled'),
    onClick: extension.onClick,
  }
}

/**
 * 校验 Workbench 扩展按钮集合并拒绝重复 ID
 *
 * @param extensions 外部扩展按钮集合
 * @returns 保持声明顺序的完整内部配置
 */
export function normalizeWorkbenchExtensions(
  extensions: readonly WorkbenchExtensionButton[],
): NormalizedWorkbenchExtensionButton[] {
  const ids = new Set<string>()
  return extensions.map((extension) => {
    const normalized = normalizeWorkbenchExtension(extension)
    if (ids.has(normalized.id)) {
      throw new TypeError(`Extension id is duplicated: ${normalized.id}`)
    }
    ids.add(normalized.id)
    return normalized
  })
}

function uniqueFontFamilies(fonts: WorkbenchFontFamily[]): WorkbenchFontFamily[] {
  const values = new Set<string>()
  return fonts.map((font) => {
    const value = font.value.trim()
    const label = font.label.trim()
    if (!value || !label) {
      throw new TypeError('Font families require value and label')
    }
    if (values.has(value)) {
      throw new TypeError(`Font family value is duplicated: ${value}`)
    }
    values.add(value)
    return { value, label }
  })
}

function normalizeBranding(branding?: WorkbenchBranding): NormalizedWorkbenchBranding {
  return {
    logoUrl: branding?.logoUrl?.trim() || defaultLogoUrl,
    logoAlt: branding?.logoAlt?.trim() || 'CustomForge',
    showLogo: branding?.showLogo ?? true,
    title: branding?.title ?? 'CustomForge',
    showTitle: branding?.showTitle ?? true,
    subtitle: branding?.subtitle ?? 'Product customization studio',
    showSubtitle: branding?.showSubtitle ?? true,
  }
}

/**
 * 补全并校验 Workbench 默认配置
 *
 * @param options 外部 Workbench 配置
 * @returns 不包含挂载容器的完整内部配置
 */
export function normalizeWorkbenchOptions(
  options: WorkbenchOptions,
): NormalizedWorkbenchOptions {
  return {
    classNames: normalizeClassNames(options.className),
    editorWidth: positiveInteger(options.editorWidth, 1024, 'editorWidth'),
    editorHeight: positiveInteger(options.editorHeight, 512, 'editorHeight'),
    historyLimit: positiveInteger(options.historyLimit, 50, 'historyLimit'),
    product: options.product,
    appearance: options.appearance,
    features: { ...defaultFeatures, ...options.features },
    layout: { ...defaultLayout, ...options.layout },
    branding: normalizeBranding(options.branding),
    labels: { ...defaultLabels, ...options.labels },
    theme: { ...defaultTheme, ...options.theme },
    icons: {
      enabled: options.icons?.enabled ?? true,
      sources: { ...options.icons?.sources },
    },
    textPresets: uniqueTextPresets(options.textPresets ?? defaultTextPresets),
    fontFamilies: uniqueFontFamilies(
      options.fontFamilies ?? defaultFontFamilies,
    ),
    backgrounds: uniqueAssets(
      options.assets?.backgrounds ?? builtInAssetLibrary.backgrounds,
      'Background',
    ),
    elements: uniqueAssets(
      options.assets?.elements ?? builtInAssetLibrary.elements,
      'Element',
    ),
    extensions: normalizeWorkbenchExtensions(options.extensions ?? []),
    formatError: options.formatError ?? defaultErrorFormatter,
  }
}
