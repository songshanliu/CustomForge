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
 */
export interface AddTextOptions {
  /** 文字内容 */
  text?: string

  /** 文字在画布中的横坐标，单位为像素 */
  x?: number

  /** 文字在画布中的纵坐标，单位为像素 */
  y?: number

  /** 文字编辑框宽度，单位为像素 */
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
 */
export interface AddImageOptions {
  /** 图片地址，支持远程地址、Data URL 和 Blob URL */
  src: string

  /** 图片中心在画布中的横坐标，单位为像素 */
  x?: number

  /** 图片中心在画布中的纵坐标，单位为像素 */
  y?: number

  /** 图片添加到画布后的显示宽度，单位为像素 */
  width?: number
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
