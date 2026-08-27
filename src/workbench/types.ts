import type {
  ElementTarget,
  ProductConfiguration,
} from '../core/types'

/** Workbench 可显示的功能控件 */
export interface WorkbenchFeatures {
  /** 是否显示添加文字控件，默认为 true */
  addText: boolean

  /** 是否显示添加图片控件，默认为 true */
  addImage: boolean

  /** 是否显示删除选中对象控件，默认为 true */
  deleteSelection: boolean

  /** 是否显示保存 Design JSON 控件，默认为 true */
  saveDesign: boolean

  /** 是否显示加载 Design JSON 控件，默认为 true */
  loadDesign: boolean

  /** 是否显示远程产品加载控件，默认为 true */
  loadRemoteProduct: boolean

  /** 是否显示 PNG 导出控件，默认为 true */
  exportTexture: boolean

  /** 是否显示三维视角重置控件，默认为 true */
  resetView: boolean

  /** 是否允许通过图层面板调整对象顺序，默认为 true */
  reorderObjects: boolean

  /** 是否允许通过图层面板切换对象可见性，默认为 true */
  toggleObjectVisibility: boolean

  /** 是否允许通过图层面板锁定对象，默认为 true */
  lockObjects: boolean

  /** 是否允许通过图层面板重命名对象，默认为 true */
  renameObjects: boolean
}

/** Workbench 可显示的布局区域 */
export interface WorkbenchLayout {
  /** 是否显示包含品牌和全局操作的顶部栏，默认为 true */
  header: boolean

  /** 是否显示二维编辑器标题栏，默认为 true */
  editorHeader: boolean

  /** 是否显示三维查看器标题栏，默认为 true */
  viewerHeader: boolean

  /** 是否显示二维编辑工具栏，默认为 true */
  toolbar: boolean

  /** 是否显示对象图层面板，默认为 true */
  layers: boolean

  /** 是否显示底部运行状态栏，默认为 true */
  status: boolean
}

/** Workbench 顶部栏品牌信息 */
export interface WorkbenchBranding {
  /** 品牌标题，默认为 CustomForge */
  title?: string

  /** 品牌副标题，默认为 Product customization workbench */
  subtitle?: string
}

/** Workbench 初始化配置 */
export interface WorkbenchOptions {
  /** Workbench 独占使用的挂载元素或 CSS 选择器 */
  container: ElementTarget

  /** 二维编辑画布的逻辑宽度，单位为像素，默认为 1024 */
  editorWidth?: number

  /** 二维编辑画布的逻辑高度，单位为像素，默认为 512 */
  editorHeight?: number

  /** 初始化时加载的产品配置 */
  product?: ProductConfiguration

  /** 功能控件开关，未传字段使用默认值 */
  features?: Partial<WorkbenchFeatures>

  /** 布局区域开关，未传字段使用默认值 */
  layout?: Partial<WorkbenchLayout>

  /** 顶部栏使用的可选品牌信息 */
  branding?: WorkbenchBranding
}

/** Workbench 功能控件名称 */
export type WorkbenchFeatureName = keyof WorkbenchFeatures

/** Workbench 布局区域名称 */
export type WorkbenchLayoutName = keyof WorkbenchLayout

/** Workbench 状态提示样式 */
export type WorkbenchStatusMode = 'ready' | 'busy' | 'error'
