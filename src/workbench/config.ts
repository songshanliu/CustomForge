import defaultLogoUrl from './assets/CustomForgeLogo.png'
import { builtInAssetLibrary } from './assets/catalog'
import type {
  WorkbenchAsset,
  WorkbenchBranding,
  WorkbenchFeatures,
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
  /** 二维编辑画布的逻辑宽度 */
  editorWidth: number

  /** 二维编辑画布的逻辑高度 */
  editorHeight: number

  /** 最多保留的撤销步骤数量 */
  historyLimit: number

  /** 初始化产品配置 */
  product: WorkbenchOptions['product']

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

  /** 可用背景素材 */
  backgrounds: WorkbenchAsset[]

  /** 可用装饰元素 */
  elements: WorkbenchAsset[]
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
  textPresets: 'Style',
  textColor: 'Color',
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
  modelUrl: 'GLB or GLTF URL',
  advancedProductOptions: 'Advanced options',
  textureUrl: 'Base artwork URL (optional)',
  textureUrlHint: 'Placed beneath all editable objects',
  surfaceMesh: 'Printable mesh name',
  surfaceMeshHint: 'The model mesh that receives the design; defaults to PrintArea',
  flipTexture: 'Flip texture vertically',
  flipTextureHint: 'Only enable this when the design appears upside down',
  useDemo: 'Use built-in demo',
  starting: 'Starting',
  productReady: 'Product ready',
  designSaved: 'Design saved',
  designLoaded: 'Design loaded',
  undoComplete: 'Undo complete',
  redoComplete: 'Redo complete',
  objectCountOne: '{count} object',
  objectCountMany: '{count} objects',
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
    editorWidth: positiveInteger(options.editorWidth, 1024, 'editorWidth'),
    editorHeight: positiveInteger(options.editorHeight, 512, 'editorHeight'),
    historyLimit: positiveInteger(options.historyLimit, 50, 'historyLimit'),
    product: options.product,
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
    backgrounds: uniqueAssets(
      options.assets?.backgrounds ?? builtInAssetLibrary.backgrounds,
      'Background',
    ),
    elements: uniqueAssets(
      options.assets?.elements ?? builtInAssetLibrary.elements,
      'Element',
    ),
  }
}
