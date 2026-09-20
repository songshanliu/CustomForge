/**
 * DOM 元素或用于查找元素的 CSS 选择器
 */
export type ElementTarget = HTMLElement | string

/**
 * 产品配置
 */
export interface ProductConfiguration {
  /** GLB 或 GLTF 模型的远程地址，不传时使用随包提供的 cup_decal_small_margins.glb */
  modelUrl?: string

  /** 二维编辑器使用的可选基础纹理地址 */
  textureUrl?: string

  /** 接收实时纹理的模型 Mesh 名称，默认为 PrintArea */
  surfaceMesh?: string

  /** 是否在映射到三维模型前垂直翻转纹理，默认为 false */
  textureFlipY?: boolean
}

/** 补全默认值后的产品配置快照 */
export interface ResolvedProductConfiguration {
  /** 清理空白后的模型地址，缺省时使用随包模型 */
  modelUrl?: string

  /** 清理空白后的基础纹理地址 */
  textureUrl?: string

  /** 接收实时纹理的模型 Mesh 名称 */
  surfaceMesh: string

  /** 是否在映射到三维模型前垂直翻转纹理 */
  textureFlipY: boolean
}

/** 二维编辑器交互元素的外观配置 */
export interface EditorAppearance {
  /** 框选区域填充色，默认为 rgba(19, 113, 125, 0.12) */
  selectionFill?: string

  /** 框选区域边框色，默认为 #13717d */
  selectionBorder?: string

  /** 对象控制点填充色，默认为 #ffffff */
  controlFill?: string

  /** 对象控制点描边色，默认为 #13717d */
  controlBorder?: string

  /** 选中对象的边框色，默认为 #13717d */
  objectBorder?: string

  /** 对象控制点显示尺寸，单位为 CSS 像素，默认为 8 */
  controlSize?: number

  /** UV 区域辅助填充色，缺省时读取 --cfw-accent */
  uvFill?: string

  /** UV 外边界虚线颜色，默认为 #dc2626 */
  uvBoundary?: string
}

/** 三维查看器画布的外观配置 */
export interface ViewerAppearance {
  /** WebGL 画布清屏颜色，缺省时保持透明并显示容器背景 */
  backgroundColor?: string
}

/** 无界面核心所管理画布的外观配置 */
export interface CustomizerAppearance {
  /** 二维编辑器交互元素外观 */
  editor?: EditorAppearance

  /** 三维查看器画布外观 */
  viewer?: ViewerAppearance
}

/**
 * 产品定制器初始化配置
 */
export interface CustomizerOptions {
  /** 二维编辑器的挂载元素或 CSS 选择器 */
  editor: ElementTarget

  /** 三维查看器的挂载元素或 CSS 选择器 */
  viewer: ElementTarget

  /** 二维编辑画布的逻辑宽度，单位为像素，默认为 1024 */
  editorWidth?: number

  /** 二维编辑画布的逻辑高度，单位为像素，默认为 512 */
  editorHeight?: number

  /** 初始化时加载的产品配置 */
  product?: ProductConfiguration

  /** 可保留的撤销步骤数量，默认为 50 */
  historyLimit?: number

  /** 二维编辑画布的无障碍名称，默认为 UV texture editor */
  editorAriaLabel?: string

  /** 三维产品画布的无障碍名称，默认为 Interactive 3D product preview */
  viewerAriaLabel?: string

  /** addText 未提供内容时使用的默认文字，默认为 Edit this text */
  defaultText?: string

  /** 空文字对象在图层工具中的默认名称，默认为 Text */
  textObjectName?: string

  /** 普通图片对象在图层工具中的默认名称，默认为 Image */
  imageObjectName?: string

  /** 背景图片对象在图层工具中的默认名称，默认为 Background */
  backgroundObjectName?: string

  /** 二维编辑器和三维查看器的可选外观配置 */
  appearance?: CustomizerAppearance
}

/** 文字支持的水平对齐方式 */
export type TextAlignment = 'left' | 'center' | 'right'

/** 文字支持的字体样式 */
export type TextFontStyle = 'normal' | 'italic'

/** 文字字重，数字值通常使用 100 到 900 */
export type TextFontWeight = number | 'normal' | 'bold'

/**
 * 添加文字时使用的配置
 *
 * 创建后和用户变换期间，文字包围盒会自动约束在编辑画布内
 */
export interface AddTextOptions {
  /** 文字内容 */
  text?: string

  /** 图层面板中显示的可选名称 */
  name?: string

  /** 文字左上角在画布中的横坐标，单位为像素，越界时自动修正 */
  x?: number

  /** 文字左上角在画布中的纵坐标，单位为像素，越界时自动修正 */
  y?: number

  /** 文字编辑框宽度，单位为像素，包围盒过大时会等比缩小 */
  width?: number

  /** 字体名称 */
  fontFamily?: string

  /** 字体大小，单位为像素，默认为 22 */
  fontSize?: number

  /** 文字颜色，支持 CSS 颜色值 */
  color?: string

  /** 字重，默认为 700 */
  fontWeight?: TextFontWeight

  /** 是否使用斜体，默认为 normal */
  fontStyle?: TextFontStyle

  /** 是否显示下划线，默认为 false */
  underline?: boolean

  /** 文字水平对齐方式，默认为 center */
  textAlign?: TextAlignment

  /** 行高倍数，默认为 1.16 */
  lineHeight?: number

  /** 字距，单位为千分之一 em，默认为 0 */
  charSpacing?: number

  /** 文字背景 CSS 颜色，缺省时保持透明 */
  backgroundColor?: string
}

/** 更新已有文字对象时使用的内容和样式配置 */
export interface UpdateTextOptions {
  /** 新的文字内容，可以为空字符串 */
  text?: string

  /** 新的字体名称，消费页面必须已经加载该字体 */
  fontFamily?: string

  /** 新的字体大小，单位为像素 */
  fontSize?: number

  /** 新的文字 CSS 颜色 */
  color?: string

  /** 新的字重 */
  fontWeight?: TextFontWeight

  /** 新的字体样式 */
  fontStyle?: TextFontStyle

  /** 是否显示下划线 */
  underline?: boolean

  /** 新的文字水平对齐方式 */
  textAlign?: TextAlignment

  /** 新的行高倍数 */
  lineHeight?: number

  /** 新的字距，单位为千分之一 em */
  charSpacing?: number

  /** 新的文字背景 CSS 颜色，传 null 时恢复透明 */
  backgroundColor?: string | null
}

/**
 * 添加图片时使用的配置
 *
 * 创建后和用户变换期间，图片包围盒会自动约束在编辑画布内
 */
export interface AddImageOptions {
  /** 图片地址，支持远程地址、Data URL 和 Blob URL */
  src: string

  /** 图层面板中显示的可选名称 */
  name?: string

  /** 图片在设计中的用途，背景会忽略位置和宽度、替换已有背景、铺满当前 UV 可打印区域并锁定在最底层 */
  role?: DesignImageRole

  /** 图片中心在画布中的横坐标，单位为像素，越界时自动修正 */
  x?: number

  /** 图片中心在画布中的纵坐标，单位为像素，越界时自动修正 */
  y?: number

  /** 图片添加到画布后的显示宽度，单位为像素，包围盒过大时会等比缩小 */
  width?: number
}

/** Design JSON 使用的画布逻辑尺寸 */
export interface DesignCanvas {
  /** 画布逻辑宽度，单位为像素 */
  width: number

  /** 画布逻辑高度，单位为像素 */
  height: number
}

/** Design JSON 中所有可编辑对象共用的变换 */
export interface DesignObjectTransform {
  /** 对象中心在画布中的横坐标，单位为像素 */
  x: number

  /** 对象中心在画布中的纵坐标，单位为像素 */
  y: number

  /** 对象相对于原始尺寸的横向缩放倍数 */
  scaleX: number

  /** 对象相对于原始尺寸的纵向缩放倍数 */
  scaleY: number

  /** 对象顺时针旋转角度，单位为度 */
  rotation: number

  /** 是否沿对象自身横轴翻转 */
  flipX: boolean

  /** 是否沿对象自身纵轴翻转 */
  flipY: boolean
}

/** 以对象中心点为原点更新现有对象时使用的变换 */
export interface UpdateObjectTransformOptions {
  /** 新的对象中心横坐标，单位为逻辑像素 */
  x?: number

  /** 新的对象中心纵坐标，单位为逻辑像素 */
  y?: number

  /** 新的横向缩放倍数，必须大于 0 */
  scaleX?: number

  /** 新的纵向缩放倍数，必须大于 0 */
  scaleY?: number

  /** 新的顺时针旋转角度，单位为度 */
  rotation?: number

  /** 是否沿对象自身横轴翻转 */
  flipX?: boolean

  /** 是否沿对象自身纵轴翻转 */
  flipY?: boolean
}

/** Design JSON 中可编辑对象共用的图层状态 */
export interface DesignObjectState {
  /** 图层面板使用的可选名称，缺省时由对象内容生成 */
  name?: string

  /** 对象是否参与二维画布、三维纹理和 PNG 渲染，默认为 true */
  visible?: boolean

  /** 对象是否禁止通过画布控件变换，默认为 false */
  locked?: boolean
}

/** Design JSON 图片对象在设计中的用途 */
export type DesignImageRole = 'element' | 'background'

/** Design JSON 中的文字对象 */
export interface TextDesignObject extends DesignObjectState {
  /** 文档内稳定且唯一的对象标识 */
  id: string

  /** 用于区分联合类型的对象种类 */
  type: 'text'

  /** 对象位置和变换 */
  transform: DesignObjectTransform

  /** 文字内容，可以为空字符串 */
  text: string

  /** 未应用缩放前的文字编辑框宽度，单位为像素 */
  width: number

  /** 字体名称，恢复时依赖消费页面提供对应字体 */
  fontFamily: string

  /** 未应用缩放前的字体大小，单位为像素 */
  fontSize: number

  /** 文字颜色，仅保存 CSS 字符串颜色 */
  color: string

  /** 字重，旧版文档缺省时使用 700 */
  fontWeight?: TextFontWeight

  /** 字体样式，旧版文档缺省时使用 normal */
  fontStyle?: TextFontStyle

  /** 是否显示下划线，旧版文档缺省时使用 false */
  underline?: boolean

  /** 文字水平对齐方式，旧版文档缺省时使用 center */
  textAlign?: TextAlignment

  /** 行高倍数，旧版文档缺省时使用 1.16 */
  lineHeight?: number

  /** 字距，单位为千分之一 em，旧版文档缺省时使用 0 */
  charSpacing?: number

  /** 文字背景 CSS 颜色，缺省时保持透明 */
  backgroundColor?: string
}

/** Design JSON 中的图片对象 */
export interface ImageDesignObject extends DesignObjectState {
  /** 文档内稳定且唯一的对象标识 */
  id: string

  /** 用于区分联合类型的对象种类 */
  type: 'image'

  /** 对象位置和变换 */
  transform: DesignObjectTransform

  /** 可重新加载的远程 URL 或 Data URL，不允许短生命周期 Blob URL */
  src: string

  /** 图片用途，缺省时按普通装饰元素处理 */
  role?: DesignImageRole
}

/** Design JSON 当前支持的可编辑对象 */
export type DesignObject = TextDesignObject | ImageDesignObject

/**
 * 可持久化并恢复的单画布设计文档
 *
 * 只包含二维可编辑对象，不包含产品模型、目标 Mesh 或基础纹理配置
 */
export interface DesignDocument {
  /** Schema 版本，当前固定为 1 */
  version: 1

  /** 保存设计时使用的逻辑画布尺寸 */
  canvas: DesignCanvas

  /** 按渲染层级从后到前排列的可编辑对象 */
  objects: DesignObject[]
}

/** 撤销与重做历史的可用状态 */
export interface HistoryState {
  /** 当前是否存在可以撤销的设计快照 */
  canUndo: boolean

  /** 当前是否存在可以重做的设计快照 */
  canRedo: boolean
}

/** 逻辑画布中的轴对齐区域 */
export interface CanvasBounds {
  /** 左边缘横坐标，单位为逻辑像素 */
  left: number

  /** 上边缘纵坐标，单位为逻辑像素 */
  top: number

  /** 区域宽度，单位为逻辑像素 */
  width: number

  /** 区域高度，单位为逻辑像素 */
  height: number
}

/** 三维空间中的坐标值 */
export interface Vector3Value {
  /** 横轴坐标 */
  x: number

  /** 纵轴坐标 */
  y: number

  /** 深度轴坐标 */
  z: number
}

/** 可保存并恢复的三维观察视角 */
export interface ProductViewState {
  /** 透视相机在三维场景中的位置 */
  position: Vector3Value

  /** 轨道控制器围绕观察的目标点 */
  target: Vector3Value
}

/** 自定义 UI 可以一次读取的核心状态快照 */
export interface CustomizerState {
  /** 当前补全默认值后的产品配置 */
  product: ResolvedProductConfiguration

  /** 当前逻辑画布尺寸 */
  canvas: DesignCanvas

  /** 当前产品 UV 在逻辑画布中的可打印包围框 */
  printableBounds: CanvasBounds

  /** 按从后到前顺序排列的设计对象 */
  objects: DesignObject[]

  /** 按画布层级排列的当前选中对象 ID */
  selectedObjectIds: string[]

  /** 当前撤销与重做可用状态 */
  history: HistoryState

  /** 当前三维观察视角 */
  view: ProductViewState
}

/**
 * 产品定制器事件及其载荷
 */
export interface CustomizerEventMap {
  /** 二维设计内容或图层状态发生变化 */
  change: { objectCount: number }

  /** 模型、纹理或图片处理失败 */
  error: { error: Error }

  /** 撤销或重做可用状态发生变化 */
  historychange: HistoryState

  /** 产品模型和纹理完成加载 */
  ready: { product: ResolvedProductConfiguration }

  /** 二维编辑器的选中状态发生变化，objectIds 按画布层级从后到前排列 */
  selectionchange: { hasSelection: boolean; objectIds: string[] }

  /** 加载或运行状态发生变化 */
  status: { message: string }

  /** 用户操作或 API 调整了三维观察视角 */
  viewchange: ProductViewState
}

/**
 * 产品定制器支持的事件名称
 */
export type CustomizerEventName = keyof CustomizerEventMap
