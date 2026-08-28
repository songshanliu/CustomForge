/**
 * DOM 元素或用于查找元素的 CSS 选择器
 */
export type ElementTarget = HTMLElement | string

/** 设计辅助区域在纹理画布中的归一化矩形 */
export interface DesignGuideArea {
  /** 左边界相对画布宽度的比例，范围为 0-1 */
  x: number

  /** 上边界相对画布高度的比例，范围为 0-1 */
  y: number

  /** 区域宽度相对画布宽度的比例，必须大于 0 且不越过右边界 */
  width: number

  /** 区域高度相对画布高度的比例，必须大于 0 且不越过下边界 */
  height: number
}

/** 二维画布中只供定位参考且不进入三维纹理或 PNG 的产品辅助配置 */
export interface ProductDesignGuideConfiguration {
  /** 初次加载产品时是否显示辅助层，默认为 true */
  visible?: boolean

  /** 是否从目标 Mesh 自动提取并显示 UV 岛边界，默认为 true */
  showUv?: boolean

  /** 覆盖整个编辑区的可选 SVG 或 PNG 模板地址，需允许跨域读取 */
  templateUrl?: string

  /** 推荐放置重要文字和图形的可选安全区 */
  safeArea?: DesignGuideArea

  /** 包含裁切余量的可选出血区 */
  bleedArea?: DesignGuideArea
}

/** 浏览器可以直接读取的产品模型来源 */
export type ProductModelSource = string | Blob | ArrayBuffer

/** 自动区域候选的评分侧重 */
export type ProductDesignAreaStrategy = 'balanced' | 'flat' | 'visible'

/** 产品设计区域的生成配置 */
export interface ProductDesignAreaConfiguration {
  /**
   * 设计区域来源，远程模型未指定 surfaceMesh 时默认为 auto，
   * 显式提供 surfaceMesh 或使用内置演示模型时默认为 existing-uv
   */
  mode?: 'auto' | 'existing-uv'

  /** 自动模式最多保留的候选区域数量，默认为 4，范围为 1-8 */
  maxAreas?: number

  /** 每个自动区域纹理的建议边长，单位为像素，默认为 1024 */
  textureSize?: number

  /** 自动候选评分侧重，默认为 balanced */
  strategy?: ProductDesignAreaStrategy

  /** 是否允许通过三维模型点击切换自动候选区域，默认为 true */
  allowSurfacePick?: boolean
}

/** 产品配置 */
export interface ProductConfiguration {
  /**
   * GLB 或 GLTF 模型来源，Blob 和 ArrayBuffer 只支持资源自包含的 GLB
   *
   * 不能与 modelUrl 同时提供，读取 Blob 不会创建长期存在的对象 URL
   */
  model?: ProductModelSource

  /** GLB 或 GLTF 模型的兼容远程地址，不传 model 和 modelUrl 时使用内置演示模型 */
  modelUrl?: string

  /** 二维编辑器使用的可选基础纹理地址 */
  textureUrl?: string

  /** existing-uv 模式下接收实时纹理的 Mesh 名称，默认为 PrintArea */
  surfaceMesh?: string

  /** existing-uv 模式是否垂直翻转纹理；自动模式忽略该值并固定为 false */
  textureFlipY?: boolean

  /** 不参与三维纹理和 PNG 导出的二维模板与 UV 辅助配置 */
  designGuide?: ProductDesignGuideConfiguration

  /** 自动生成区域或使用模型已有 UV 的配置 */
  designAreas?: ProductDesignAreaConfiguration
}

/** 设计区域的创建来源 */
export type DesignAreaSource = 'auto' | 'picked' | 'configured'

/** 设计区域的几何与参数化质量指标 */
export interface DesignAreaMetrics {
  /** 区域在模型局部坐标中的表面积 */
  surfaceArea: number

  /** 视角采样可见度，尚未采样时为 0 */
  visibility: number

  /** UV 轮廓紧凑度，范围为 0-1 */
  compactness: number

  /** 角度畸变估计，越接近 0 越好 */
  angleDistortion: number

  /** 面积畸变估计，越接近 0 越好 */
  areaDistortion: number
}

/** 可以独立编辑并映射到三维模型局部表面的设计区域 */
export interface DesignArea {
  /** 相同模型、配置和处理器版本下保持稳定的区域标识 */
  id: string

  /** 面向界面的稳定区域名称，不推断商品部件语义 */
  label: string

  /** 区域的创建来源 */
  source: DesignAreaSource

  /** 自动候选综合评分，范围为 0-1 */
  score: number

  /** 自动选择可信度，范围为 0-1 */
  confidence: number

  /** 区域纹理的建议边长，单位为像素 */
  textureSize: number

  /** 区域几何与 UV 质量指标 */
  metrics: DesignAreaMetrics
}

/** 二维编辑区域的显示视口，不改变设计坐标或纹理内容 */
export interface DesignAreaViewport {
  /** 相对于自动适配尺寸的缩放倍数，范围为 0.25-4 */
  zoom: number

  /** 相对于自动适配中心的水平平移，单位为 CSS 像素 */
  panX: number

  /** 相对于自动适配中心的垂直平移，单位为 CSS 像素 */
  panY: number
}

/** 自动产品处理阶段 */
export type ProductProcessingStage =
  | 'loading-model'
  | 'inspecting-geometry'
  | 'finding-design-areas'
  | 'unwrapping-surface'
  | 'preparing-editor'

/** 自动产品处理进度 */
export interface ProductProcessingProgress {
  /** 当前处理阶段 */
  stage: ProductProcessingStage

  /** 当前阶段完成比例，范围为 0-1 */
  progress: number

  /** 当前阶段已完成的工作项数量 */
  completed: number

  /** 当前阶段工作项总数 */
  total: number
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
}

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

  /** 字体大小，单位为像素 */
  fontSize?: number

  /** 文字颜色，支持 CSS 颜色值 */
  color?: string
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

  /** 图片在设计中的用途，背景会替换已有设计背景、忽略位置和宽度并默认锁定在最底层 */
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

/** 多区域产品设计文档中的单个区域内容 */
export interface ProductDesignAreaDocument {
  /** 保存时对应的稳定区域 ID */
  areaId: string

  /** 由来源三角形和最终 UV 生成、用于检测处理结果变化的区域指纹 */
  areaFingerprint: string

  /** 保存区域设计时使用的逻辑画布尺寸 */
  canvas: DesignCanvas

  /** 按渲染层级从后到前排列的区域设计对象 */
  objects: DesignObject[]
}

/**
 * 可持久化并恢复的多区域产品设计文档
 *
 * 加载时模型指纹和区域指纹必须与当前产品一致，避免设计映射到错误表面
 */
export interface ProductDesignDocument {
  /** Schema 版本，当前固定为 2 */
  version: 2

  /** 由静态 Mesh 路径、位置、索引和材质分组生成的模型指纹 */
  modelFingerprint: string

  /** 自动区域处理器版本 */
  processorVersion: string

  /** 保存时正在编辑的区域 ID */
  activeAreaId: string

  /** 当前产品全部区域的设计内容 */
  areas: ProductDesignAreaDocument[]
}

/** 撤销与重做历史的可用状态 */
export interface HistoryState {
  /** 当前是否存在可以撤销的设计快照 */
  canUndo: boolean

  /** 当前是否存在可以重做的设计快照 */
  canRedo: boolean
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

  /** 产品设计辅助层的显示状态发生变化 */
  designguidechange: { visible: boolean }

  /** 自动模型分析或 UV 参数化进度发生变化 */
  processingprogress: ProductProcessingProgress

  /** 当前产品可用设计区域列表发生变化 */
  designareaschange: { areas: DesignArea[] }

  /** 当前二维编辑器切换到另一个设计区域 */
  activeareachange: { area: DesignArea }

  /** 三维表面点击选择模式发生变化 */
  surfacepickchange: { active: boolean }

  /** 二维编辑视口缩放或平移发生变化 */
  editorviewportchange: DesignAreaViewport

  /** 产品模型和纹理完成加载 */
  ready: { product: ProductConfiguration }

  /** 二维编辑器的选中状态发生变化，objectIds 按画布层级从后到前排列 */
  selectionchange: { hasSelection: boolean; objectIds: string[] }

  /** 加载或运行状态发生变化 */
  status: { message: string }
}

/**
 * 产品定制器支持的事件名称
 */
export type CustomizerEventName = keyof CustomizerEventMap
