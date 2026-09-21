import type { ProductCustomizerApi } from '../core/api'
import type {
  CustomizerAppearance,
  CustomizerState,
  DesignObject,
  ElementTarget,
  ProductConfiguration,
} from '../core/types'

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

  /** 是否显示本地或远程产品加载控件，默认为 true */
  loadRemoteProduct: boolean

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

  /** 是否提供编辑区内可折叠的对象图层面板，默认为 true */
  layers: boolean

  /** 是否在三维预览区显示运行状态，默认为 true */
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

  /** 二维编辑区域模式标识 */
  editorMode: string

  /** 三维查看区域模式标识 */
  viewerMode: string

  /** 二维编辑画布的无障碍名称 */
  editorCanvas: string

  /** 三维产品画布的无障碍名称 */
  viewerCanvas: string

  /** 图层面板标题 */
  layers: string

  /** 空图层列表提示 */
  noObjects: string

  /** 添加文字命令 */
  addText: string

  /** 文字格式栏的无障碍名称 */
  textFormatting: string

  /** 展开更多文字格式控件的命令 */
  moreTextOptions: string

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

  /** 将选中图片设为设计背景的命令 */
  setImageAsBackground: string

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

  /** 未提供文字内容时添加到画布的默认文字 */
  defaultText: string

  /** 文字内容为空时的校验提示 */
  textRequired: string

  /** 文字排版预设区域标题 */
  textPresets: string

  /** 文字颜色字段标签 */
  textColor: string

  /** 黑色预设名称 */
  colorBlack: string

  /** 深灰色预设名称 */
  colorSlate: string

  /** 灰色预设名称 */
  colorGray: string

  /** 白色预设名称 */
  colorWhite: string

  /** 红色预设名称 */
  colorRed: string

  /** 橙色预设名称 */
  colorOrange: string

  /** 黄色预设名称 */
  colorYellow: string

  /** 绿色预设名称 */
  colorGreen: string

  /** 青绿色预设名称 */
  colorTeal: string

  /** 青色预设名称 */
  colorCyan: string

  /** 蓝色预设名称 */
  colorBlue: string

  /** 紫色预设名称 */
  colorPurple: string

  /** 粉色预设名称 */
  colorPink: string

  /** 棕色预设名称 */
  colorBrown: string

  /** 多选对象属性值不一致时的占位文案 */
  mixedValue: string

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

  /** 产品来源 Dialog 辅助标题 */
  productDialogEyebrow: string

  /** 产品来源 Dialog 标题 */
  productDialogTitle: string

  /** 产品来源选择控件名称 */
  productSourceMethod: string

  /** 本地 GLB 来源选项 */
  productFileSource: string

  /** 远程模型地址来源选项 */
  productUrlSource: string

  /** 本地 GLB 文件字段标签 */
  modelFile: string

  /** 选择本地 GLB 文件命令 */
  chooseModelFile: string

  /** 尚未选择本地 GLB 文件时的状态 */
  noModelFileSelected: string

  /** 本地模型文件格式错误提示 */
  invalidModelFile: string

  /** 尚未选择本地模型文件时的校验提示 */
  modelFileRequired: string

  /** 模型地址字段标签 */
  modelUrl: string

  /** 模型地址输入框占位文案 */
  modelUrlPlaceholder: string

  /** 模型地址为空时的校验提示 */
  modelUrlRequired: string

  /** 模型地址格式错误时的校验提示 */
  invalidModelUrl: string

  /** 产品高级设置标题 */
  advancedProductOptions: string

  /** 基础纹理地址字段标签 */
  textureUrl: string

  /** 基础纹理地址输入框占位文案 */
  textureUrlPlaceholder: string

  /** 基础纹理地址格式错误时的校验提示 */
  invalidTextureUrl: string

  /** 基础纹理用途说明 */
  textureUrlHint: string

  /** 可定制 Mesh 字段标签 */
  surfaceMesh: string

  /** 可定制 Mesh 名称为空时的校验提示 */
  surfaceMeshRequired: string

  /** 可定制 Mesh 用途说明 */
  surfaceMeshHint: string

  /** 垂直翻转纹理字段标签 */
  flipTexture: string

  /** 垂直翻转纹理用途说明 */
  flipTextureHint: string

  /** 使用内置演示产品命令 */
  useDemo: string

  /** 图片加载中的状态文案 */
  addingImage: string

  /** Design JSON 加载中的状态文案 */
  loadingDesign: string

  /** 产品加载中的状态文案 */
  loadingProduct: string

  /** 撤销执行中的状态文案 */
  undoing: string

  /** 重做执行中的状态文案 */
  redoing: string

  /** 初始状态文案 */
  starting: string

  /** 产品就绪状态文案 */
  productReady: string

  /** 设计保存成功状态文案 */
  designSaved: string

  /** 文字添加成功状态文案 */
  textAdded: string

  /** 图片添加成功状态文案 */
  imageAdded: string

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

  /** 保存 Design JSON 时使用的文件名 */
  designFilename: string
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

  /** 控件圆角 CSS 值，默认为 4px */
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
  | 'hideLayer'
  | 'imageObject'
  | 'italic'
  | 'layers'
  | 'letterSpacing'
  | 'lineHeight'
  | 'loadDesign'
  | 'loadProduct'
  | 'lock'
  | 'moreTextOptions'
  | 'moveBackward'
  | 'moveForward'
  | 'redo'
  | 'resetView'
  | 'saveDesign'
  | 'setImageAsBackground'
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

/** Workbench 字体选择器条目 */
export interface WorkbenchFontFamily {
  /** 写入文字对象的 CSS 字体族名称 */
  value: string

  /** 字体选择器中显示的名称 */
  label: string
}

/**
 * 将底层异常转换为用户可见文案
 *
 * @param error 模型、图片、UV 或 Design JSON 操作抛出的原始值
 * @returns 应显示在 Workbench 状态区域的文案
 */
export type WorkbenchErrorFormatter = (error: unknown) => string

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
  /** 铺满当前 UV 可打印区域并锁定在底层的背景素材 */
  backgrounds?: WorkbenchAsset[]

  /** 作为普通可编辑图片加入画布的装饰元素 */
  elements?: WorkbenchAsset[]
}

/** Workbench 扩展按钮可挂载的稳定位置 */
export type WorkbenchExtensionPlacement =
  | 'globalActions'
  | 'editorToolbar'
  | 'selectionToolbar'
  | 'layerActions'

/** Workbench 扩展按钮的视觉语义 */
export type WorkbenchExtensionVariant =
  | 'primary'
  | 'secondary'
  | 'plain'
  | 'danger'

/** 扩展按钮判断显示和禁用状态时接收的独立业务快照 */
export interface WorkbenchExtensionStateContext {
  /** 当前 Workbench 公共接口 */
  workbench: CustomForgeWorkbenchApi

  /** 当前无界面核心公共接口 */
  customizer: ProductCustomizerApi

  /** 计算本轮扩展状态时取得的核心状态快照 */
  state: CustomizerState

  /** 按画布层级排列的当前选中对象快照 */
  selection: DesignObject[]

  /** 当前图层对象，仅 layerActions 位置提供 */
  layer?: DesignObject
}

/** 扩展按钮执行点击处理时接收的上下文 */
export interface WorkbenchExtensionActionContext
  extends WorkbenchExtensionStateContext {
  /** 触发扩展命令的原始鼠标事件 */
  event: MouseEvent

  /** 可用于定位菜单、浮层或读取按钮尺寸的实际按钮元素 */
  anchor: HTMLButtonElement

  /** Workbench 销毁时会中止的信号，异步扩展应主动响应 */
  signal: AbortSignal
}

/** 根据最新 Workbench 状态计算扩展按钮布尔状态的函数 */
export type WorkbenchExtensionPredicate = (
  context: WorkbenchExtensionStateContext,
) => boolean

/** 扩展按钮执行的同步或异步命令 */
export type WorkbenchExtensionAction = (
  context: WorkbenchExtensionActionContext,
) => void | Promise<void>

/** 可注册到默认 Workbench 稳定位置的扩展按钮 */
export interface WorkbenchExtensionButton {
  /** 当前 Workbench 内唯一的稳定标识，必须以字母或数字开头，且只允许字母、数字、点、下划线和连字符 */
  id: string

  /** 按钮挂载位置 */
  placement: WorkbenchExtensionPlacement

  /** 可见文案、Tooltip 和无障碍名称 */
  label: string

  /** 自定义装饰图标地址，支持普通 URL、Data URL 和 Blob URL；Blob URL 的释放由调用方负责 */
  iconUrl?: string

  /** 是否显示文字，默认除紧凑图层操作外均为 true；隐藏文字时必须提供 iconUrl */
  showLabel?: boolean

  /** 按钮视觉语义，全局操作默认为 secondary，其他位置默认为 plain */
  variant?: WorkbenchExtensionVariant

  /** 同一挂载位置内的升序排列值，默认为 0 */
  order?: number

  /** 添加到按钮元素的一个或多个宿主 CSS 类名 */
  className?: string

  /** 固定值或根据最新状态同步计算的可见条件，默认为 true；判断函数应保持无副作用 */
  visible?: boolean | WorkbenchExtensionPredicate

  /** 固定值或根据最新状态同步计算的禁用条件，默认为 false；判断函数应保持无副作用 */
  disabled?: boolean | WorkbenchExtensionPredicate

  /** 点击按钮时执行的命令；Promise 未结束时自动进入 loading，异常通过 formatError 显示 */
  onClick: WorkbenchExtensionAction
}

/** Workbench 初始化配置 */
export interface WorkbenchOptions {
  /** Workbench 独占使用的挂载元素或 CSS 选择器 */
  container: ElementTarget

  /** 添加到 Workbench 根元素的一个或多个 CSS 类名 */
  className?: string

  /** 二维编辑画布的逻辑宽度，单位为像素，默认为 1024 */
  editorWidth?: number

  /** 二维编辑画布的逻辑高度，单位为像素，默认为 512 */
  editorHeight?: number

  /** 最多保留的撤销步骤数量，默认为 50 */
  historyLimit?: number

  /** 初始化时加载的产品配置 */
  product?: ProductConfiguration

  /** 二维选择控件、UV 辅助层和三维画布的外观配置 */
  appearance?: CustomizerAppearance

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

  /** 替换字体选择器条目，预设使用但未列出的字体会以 CSS 字体族名称补充 */
  fontFamilies?: WorkbenchFontFamily[]

  /** 图片 Dialog 使用的背景与装饰素材 */
  assets?: WorkbenchAssetLibrary

  /** 初始化时注册到默认界面稳定位置的扩展按钮 */
  extensions?: readonly WorkbenchExtensionButton[]

  /** 将模型、图片和 Design JSON 异常转换为界面提示 */
  formatError?: WorkbenchErrorFormatter
}

/** Workbench 功能控件名称 */
export type WorkbenchFeatureName = keyof WorkbenchFeatures

/** Workbench 布局区域名称 */
export type WorkbenchLayoutName = keyof WorkbenchLayout

/** Workbench 状态提示样式 */
export type WorkbenchStatusMode = 'ready' | 'busy' | 'error'

/**
 * 带默认界面的产品定制工作台能力契约
 *
 * 可通过根元素、实例级 className 和主题变量调整默认样式；完全自建 UI 时应直接使用 ProductCustomizerApi
 */
export interface CustomForgeWorkbenchApi {
  /** Workbench 使用的无界面核心接口 */
  readonly customizer: ProductCustomizerApi

  /** 可用于实例级 DOM 集成和附加样式的 Workbench 根元素 */
  readonly element: HTMLElement

  /** 返回当前功能控件开关的独立快照 */
  getFeatures(): WorkbenchFeatures

  /** 在运行时显示或隐藏一项默认功能控件 */
  setFeature(feature: WorkbenchFeatureName, enabled: boolean): void

  /** 返回当前布局区域开关的独立快照 */
  getLayout(): WorkbenchLayout

  /** 在运行时显示或隐藏一个默认布局区域 */
  setLayout(section: WorkbenchLayoutName, visible: boolean): void

  /** 返回当前完整主题的独立快照 */
  getTheme(): WorkbenchTheme

  /** 合并主题变量、立即更新当前实例并返回完整主题 */
  setTheme(theme: Partial<WorkbenchTheme>): WorkbenchTheme

  /** 返回当前已注册扩展按钮的独立配置快照，不包含运行中的 loading 状态 */
  getExtensions(): WorkbenchExtensionButton[]

  /**
   * 注册并立即渲染一个扩展按钮
   *
   * @param extension 扩展按钮配置
   * @returns 仅在本次注册仍有效时移除该扩展的幂等清理函数
   * @throws 配置无效、ID 重复或 Workbench 无法渲染时抛出错误
   */
  registerExtension(extension: WorkbenchExtensionButton): () => void

  /**
   * 按稳定 ID 移除扩展按钮
   *
   * @param id 注册时使用的扩展 ID
   * @returns 移除前是否存在该扩展
   */
  removeExtension(id: string): boolean

  /** 使用最新核心状态重新计算所有扩展按钮的显示和禁用条件，供宿主状态变化后调用 */
  refreshExtensions(): void

  /** 更新默认界面的状态文案和状态样式 */
  setStatus(message: string, mode?: WorkbenchStatusMode): void

  /** 释放默认界面、核心实例和关联浏览器资源 */
  destroy(): void
}
