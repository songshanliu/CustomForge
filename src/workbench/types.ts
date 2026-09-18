import type { ElementTarget, ProductConfiguration } from '../core/types'

/** Workbench 可显示的功能控件 */
export interface WorkbenchFeatures {
  /** 是否显示添加文字控件，默认为 true */
  addText: boolean

  /** 是否在选中文字时显示文字格式栏，默认为 true */
  textFormatting: boolean

  /** 是否显示添加图片控件，默认为 true */
  addImage: boolean

  /** 是否显示撤销和重做控件，默认为 true */
  undoRedo: boolean

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

  /** 是否在图片 Dialog 中显示预设背景，默认为 true */
  presetBackgrounds: boolean

  /** 是否在图片 Dialog 中显示预设装饰元素，默认为 true */
  presetElements: boolean
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
  /** 品牌 Logo 地址，默认为包内 CustomForge Logo */
  logoUrl?: string

  /** 品牌 Logo 替代文字，默认为 CustomForge */
  logoAlt?: string

  /** 是否显示品牌 Logo，默认为 true */
  showLogo?: boolean

  /** 品牌标题，默认为 CustomForge */
  title?: string

  /** 是否显示品牌标题，默认为 true */
  showTitle?: boolean

  /** 品牌副标题，默认为 Product customization studio */
  subtitle?: string

  /** 是否显示品牌副标题，默认为 true */
  showSubtitle?: boolean
}

/** Workbench 可覆盖的界面文案 */
export interface WorkbenchLabels {
  /** Workbench 无障碍名称 */
  workbench: string

  /** 二维编辑区域标题 */
  editorTitle: string

  /** 三维查看区域标题 */
  viewerTitle: string

  /** 图层面板标题 */
  layers: string

  /** 空图层列表提示 */
  noObjects: string

  /** 添加文字命令 */
  addText: string

  /** 文字格式栏的无障碍名称 */
  textFormatting: string

  /** 进入画布文字编辑状态的命令 */
  editText: string

  /** 字体选择控件名称 */
  fontFamily: string

  /** 字号控件名称 */
  fontSize: string

  /** 粗体命令 */
  bold: string

  /** 斜体命令 */
  italic: string

  /** 下划线命令 */
  underline: string

  /** 左对齐命令 */
  alignLeft: string

  /** 居中对齐命令 */
  alignCenter: string

  /** 右对齐命令 */
  alignRight: string

  /** 文字背景颜色控件名称 */
  textBackground: string

  /** 行高控件名称 */
  lineHeight: string

  /** 字距控件名称 */
  letterSpacing: string

  /** 添加图片命令 */
  addImage: string

  /** 撤销命令 */
  undo: string

  /** 重做命令 */
  redo: string

  /** 保存设计命令 */
  saveDesign: string

  /** 加载设计命令 */
  loadDesign: string

  /** 删除选中对象命令 */
  deleteSelection: string

  /** 加载产品命令 */
  loadProduct: string

  /** 导出 PNG 命令 */
  exportTexture: string

  /** 重置三维视角命令 */
  resetView: string

  /** 文字图层类型名称 */
  textObject: string

  /** 图片图层类型名称 */
  imageObject: string

  /** 设计背景图层类型名称 */
  backgroundObject: string

  /** 显示图层命令 */
  showLayer: string

  /** 隐藏图层命令 */
  hideLayer: string

  /** 锁定图层命令 */
  lockLayer: string

  /** 解锁图层命令 */
  unlockLayer: string

  /** 图层前移命令 */
  moveLayerForward: string

  /** 图层后移命令 */
  moveLayerBackward: string

  /** 删除图层命令 */
  deleteLayer: string

  /** 文字 Dialog 辅助标题 */
  textDialogEyebrow: string

  /** 文字 Dialog 标题 */
  textDialogTitle: string

  /** 文字输入字段标签 */
  textInputLabel: string

  /** 文字输入占位文案 */
  textInputPlaceholder: string

  /** 文字排版预设区域标题 */
  textPresets: string

  /** 文字颜色字段标签 */
  textColor: string

  /** 确认添加文字命令 */
  addTextConfirm: string

  /** 图片 Dialog 辅助标题 */
  imageDialogEyebrow: string

  /** 图片 Dialog 标题 */
  imageDialogTitle: string

  /** 上传图片页签 */
  uploadImageTab: string

  /** 预设背景页签 */
  backgroundsTab: string

  /** 装饰元素页签 */
  elementsTab: string

  /** 选择本地图片命令 */
  chooseImage: string

  /** 尚未选择本地图片时的状态 */
  noImageSelected: string

  /** 未提供预设素材时的状态 */
  noPresetAssets: string

  /** 确认添加图片命令 */
  addImageConfirm: string

  /** 关闭 Dialog 命令 */
  close: string

  /** 取消命令 */
  cancel: string

  /** 远程产品 Dialog 辅助标题 */
  productDialogEyebrow: string

  /** 远程产品 Dialog 标题 */
  productDialogTitle: string

  /** 模型地址字段标签 */
  modelUrl: string

  /** 基础纹理地址字段标签 */
  textureUrl: string

  /** 可定制 Mesh 字段标签 */
  surfaceMesh: string

  /** 垂直翻转纹理字段标签 */
  flipTexture: string

  /** 使用内置演示产品命令 */
  useDemo: string

  /** 初始状态文案 */
  starting: string

  /** 产品就绪状态文案 */
  productReady: string

  /** 设计保存成功状态文案 */
  designSaved: string

  /** 设计加载成功状态文案 */
  designLoaded: string

  /** 撤销完成状态文案 */
  undoComplete: string

  /** 重做完成状态文案 */
  redoComplete: string

  /** 单个对象数量格式，其中 {count} 会被替换 */
  objectCountOne: string

  /** 多个对象数量格式，其中 {count} 会被替换 */
  objectCountMany: string
}

/** Workbench 可覆盖的主题变量 */
export interface WorkbenchTheme {
  /** 主要文字颜色 */
  ink: string

  /** 次要文字颜色 */
  muted: string

  /** 边框颜色 */
  border: string

  /** 主表面颜色 */
  surface: string

  /** 次级表面颜色 */
  surfaceMuted: string

  /** 编辑与三维舞台背景颜色 */
  stage: string

  /** 品牌强调色 */
  accent: string

  /** 品牌强调色悬停状态 */
  accentHover: string

  /** 强调色上的文字颜色 */
  accentContrast: string

  /** 危险操作颜色 */
  danger: string

  /** Workbench 字体族 CSS 值，默认加载包内 Nunito Sans 并回退到系统无衬线字体 */
  fontFamily: string

  /** 控件圆角 CSS 值，默认为 7px */
  controlRadius: string
}

/** Workbench 可覆盖的图标语义名称 */
export type WorkbenchIconName =
  | 'addImage'
  | 'addText'
  | 'alignCenter'
  | 'alignLeft'
  | 'alignRight'
  | 'backgroundObject'
  | 'bold'
  | 'close'
  | 'deleteSelection'
  | 'editText'
  | 'exportTexture'
  | 'hideLayer'
  | 'imageObject'
  | 'italic'
  | 'layers'
  | 'letterSpacing'
  | 'lineHeight'
  | 'loadDesign'
  | 'loadProduct'
  | 'lock'
  | 'moveBackward'
  | 'moveForward'
  | 'redo'
  | 'resetView'
  | 'saveDesign'
  | 'showLayer'
  | 'textBackground'
  | 'textColor'
  | 'textObject'
  | 'undo'
  | 'underline'
  | 'unlock'
  | 'upload'

/** Workbench 图标配置 */
export interface WorkbenchIconConfiguration {
  /** 是否显示内置和自定义图标，默认为 true */
  enabled?: boolean

  /** 按语义名称提供自定义图片地址，null 表示只隐藏对应图标 */
  sources?: Partial<Record<WorkbenchIconName, string | null>>
}

/** Workbench 文字排版预设 */
export interface WorkbenchTextPreset {
  /** 在当前预设集合内唯一的标识 */
  id: string

  /** 预设选择器中显示的名称 */
  name: string

  /** 预览区域使用的可选示例文字 */
  previewText?: string

  /** 添加到画布时使用的字体族 */
  fontFamily: string

  /** 添加到画布时使用的字体大小，单位为像素 */
  fontSize: number

  /** 添加到画布时使用的文字框宽度，单位为像素 */
  width: number

  /** 添加到画布时使用的 CSS 颜色值 */
  color: string
}

/** Workbench 图片素材条目 */
export interface WorkbenchAsset {
  /** 在对应素材集合内唯一的标识 */
  id: string

  /** 素材选择器中显示的名称 */
  name: string

  /** 添加到设计时加载的图片地址 */
  url: string

  /** 选择器中使用的可选缩略图地址，缺省时使用 url */
  thumbnailUrl?: string

  /** 素材图片的替代文字，缺省时使用 name */
  alt?: string
}

/** Workbench 可用的预设图片素材 */
export interface WorkbenchAssetLibrary {
  /** 铺满画布并锁定在底层的背景素材 */
  backgrounds?: WorkbenchAsset[]

  /** 作为普通可编辑图片加入画布的装饰元素 */
  elements?: WorkbenchAsset[]
}

/** Workbench 初始化配置 */
export interface WorkbenchOptions {
  /** Workbench 独占使用的挂载元素或 CSS 选择器 */
  container: ElementTarget

  /** 二维编辑画布的逻辑宽度，单位为像素，默认为 1024 */
  editorWidth?: number

  /** 二维编辑画布的逻辑高度，单位为像素，默认为 512 */
  editorHeight?: number

  /** 最多保留的撤销步骤数量，默认为 50 */
  historyLimit?: number

  /** 初始化时加载的产品配置 */
  product?: ProductConfiguration

  /** 功能控件开关，未传字段使用默认值 */
  features?: Partial<WorkbenchFeatures>

  /** 布局区域开关，未传字段使用默认值 */
  layout?: Partial<WorkbenchLayout>

  /** 顶部栏使用的可选品牌信息 */
  branding?: WorkbenchBranding

  /** 可覆盖的界面文案 */
  labels?: Partial<WorkbenchLabels>

  /** 可覆盖的主题变量 */
  theme?: Partial<WorkbenchTheme>

  /** 图标显示与替换配置 */
  icons?: WorkbenchIconConfiguration

  /** 替换内置文字排版预设，空数组表示不显示预设 */
  textPresets?: WorkbenchTextPreset[]

  /** 图片 Dialog 使用的背景与装饰素材 */
  assets?: WorkbenchAssetLibrary
}

/** Workbench 功能控件名称 */
export type WorkbenchFeatureName = keyof WorkbenchFeatures

/** Workbench 布局区域名称 */
export type WorkbenchLayoutName = keyof WorkbenchLayout

/** Workbench 状态提示样式 */
export type WorkbenchStatusMode = 'ready' | 'busy' | 'error'
