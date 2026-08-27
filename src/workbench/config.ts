import type {
  WorkbenchFeatures,
  WorkbenchLayout,
  WorkbenchOptions,
} from './types'

/** Workbench 内部使用的完整配置 */
export interface NormalizedWorkbenchOptions {
  /** 二维编辑画布的逻辑宽度 */
  editorWidth: number

  /** 二维编辑画布的逻辑高度 */
  editorHeight: number

  /** 初始化产品配置 */
  product: WorkbenchOptions['product']

  /** 完整功能开关 */
  features: WorkbenchFeatures

  /** 完整布局开关 */
  layout: WorkbenchLayout

  /** 顶部栏品牌标题 */
  brandTitle: string

  /** 顶部栏品牌副标题 */
  brandSubtitle: string
}

const defaultFeatures: WorkbenchFeatures = {
  addText: true,
  addImage: true,
  deleteSelection: true,
  saveDesign: true,
  loadDesign: true,
  loadRemoteProduct: true,
  exportTexture: true,
  resetView: true,
  reorderObjects: true,
  toggleObjectVisibility: true,
  lockObjects: true,
  renameObjects: true,
}

const defaultLayout: WorkbenchLayout = {
  header: true,
  editorHeader: true,
  viewerHeader: true,
  toolbar: true,
  layers: true,
  status: true,
}

/**
 * 补全 Workbench 默认配置
 *
 * @param options 外部 Workbench 配置
 * @returns 不包含挂载容器的完整内部配置
 */
export function normalizeWorkbenchOptions(
  options: WorkbenchOptions,
): NormalizedWorkbenchOptions {
  return {
    editorWidth: options.editorWidth ?? 1024,
    editorHeight: options.editorHeight ?? 512,
    product: options.product,
    features: { ...defaultFeatures, ...options.features },
    layout: { ...defaultLayout, ...options.layout },
    brandTitle: options.branding?.title?.trim() || 'CustomForge',
    brandSubtitle:
      options.branding?.subtitle?.trim() || 'Product customization workbench',
  }
}
