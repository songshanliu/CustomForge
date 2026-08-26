/**
 * DOM 元素或用于查找元素的 CSS 选择器
 */
export type ElementTarget = HTMLElement | string

/**
 * 产品配置
 */
export interface ProductConfiguration {
  /** GLB 或 GLTF 模型的远程地址，不传时使用内置演示模型 */
  modelUrl?: string

  /** 二维编辑器使用的可选基础纹理地址 */
  textureUrl?: string

  /** 接收实时纹理的模型 Mesh 名称，默认为 PrintArea */
  surfaceMesh?: string

  /** 是否在映射到三维模型前垂直翻转纹理 */
  textureFlipY?: boolean
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
}

/**
 * 添加文字时使用的配置
 *
 * 创建后和用户变换期间，文字包围盒会自动约束在编辑画布内
 */
export interface AddTextOptions {
  /** 文字内容 */
  text?: string

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

/** Design JSON 中的文字对象 */
export interface TextDesignObject {
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
export interface ImageDesignObject {
  /** 文档内稳定且唯一的对象标识 */
  id: string

  /** 用于区分联合类型的对象种类 */
  type: 'image'

  /** 对象位置和变换 */
  transform: DesignObjectTransform

  /** 可重新加载的远程 URL 或 Data URL，不允许短生命周期 Blob URL */
  src: string
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

/**
 * 产品定制器事件及其载荷
 */
export interface CustomizerEventMap {
  /** 二维设计发生变化 */
  change: { objectCount: number }

  /** 模型、纹理或图片处理失败 */
  error: { error: Error }

  /** 产品模型和纹理完成加载 */
  ready: { product: ProductConfiguration }

  /** 二维编辑器的选中状态发生变化 */
  selectionchange: { hasSelection: boolean }

  /** 加载或运行状态发生变化 */
  status: { message: string }
}

/**
 * 产品定制器支持的事件名称
 */
export type CustomizerEventName = keyof CustomizerEventMap
