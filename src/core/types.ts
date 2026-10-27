/**
 * DOM 元素或用于查找元素的 CSS 选择器
 */
export type ElementTarget = HTMLElement | string

/** 原始 UV 中对应一张完整设计纹理的矩形，允许负数和大于 1 的坐标 */
export interface UvDomain {
  /** 横向最小坐标 */
  minU: number
  /** 纵向最小坐标 */
  minV: number
  /** 横向最大坐标，必须大于 minU */
  maxU: number
  /** 纵向最大坐标，必须大于 minV */
  maxV: number
}

/** glTF TEXCOORD_0 到 TEXCOORD_3，与 Three.js 的 uv、uv1、uv2、uv3 对应 */
export type PrintUvChannel = 0 | 1 | 2 | 3

/** 设计映射策略；整体适配共用一个仿射变换，不重新展开或逐岛缩放 UV */
export type PrintUvMapping =
  | { /** 保留标准域及原有 UV 留白，默认模式 */ mode: 'original' }
  | { /** 将第一材质槽全部实际三角形的整体 UV 范围适配到一张设计纹理 */ mode: 'fit-bounds' }
  | {
      /** 使用显式参考域，允许保留顶点范围之外的留白 */
      mode: 'domain'
      /** 有限且不退化的原始 UV 参考矩形 */
      domain: UvDomain
    }

/** 可持久化的已解析映射；版本 1 的方向只通过纹理上传翻转一次 */
export interface DesignPrintMapping {
  /** 映射协议版本，当前为 1 */
  version: 1
  /** 接收设计的实际 Mesh 名称，固定使用其第一材质槽 */
  surfaceMesh: string
  /** 设计使用的原始 UV 通道 */
  uvChannel: PrintUvChannel
  /** 保存解析后的数值域，恢复时不重新按新模型计算 */
  domain: UvDomain
  /** CanvasTexture 上传时是否垂直翻转 */
  textureFlipY: boolean
  /** 调用方提供的不可变内容版本，SDK 不根据 URL 推断版本 */
  modelRevision?: string
}

/** 配置项实际采用的来源，instance 表示产品切换沿用当前逻辑画布 */
export type PrintConfigurationSource = 'configuration' | 'model-metadata' | 'legacy-metadata' | 'default' | 'design' | 'instance'

/** SDK 诊断标识，与 HTTP 或业务响应码无关 */
export type PrintDiagnosticCode =
  | 'UV_OUTSIDE_DESIGN_DOMAIN' | 'PRINT_UV_MISSING' | 'PRINT_UV_INVALID'
  | 'PRINT_UV_DOMAIN_DEGENERATE' | 'CANVAS_METADATA_MISSING' | 'MODEL_METADATA_INVALID'
  | 'MODEL_METADATA_IGNORED' | 'MODEL_REVISION_UNVERIFIED' | 'DESIGN_MAPPING_MISMATCH'
  | 'CANVAS_SIZE_INVALID' | 'CANVAS_SIZE_LIMIT' | 'CANVAS_SIZE_MISMATCH'
  | 'PRINT_SURFACE_MISSING' | 'PRINT_MATERIAL_UNSUPPORTED'

/** 可保留并交给宿主翻译的诊断，初始化诊断也能通过 getPrintSurfaceInfo 读取 */
export interface PrintDiagnostic {
  /** 稳定诊断标识 */
  code: PrintDiagnosticCode
  /** info 为说明，warning 为可继续使用但需要注意的情况 */
  severity: 'info' | 'warning'
  /** 默认英文说明，宿主可依据 code 自行呈现文案 */
  message: string
}

/** 当前产品的独立解析快照，不包含 Three.js、Fabric.js 或可变 TypedArray */
export interface PrintSurfaceInfo {
  /** 实际目标 Mesh 名称 */
  surfaceMesh: string
  /** 固定为第一材质槽 */
  materialIndex: 0
  /** 二维提取与设计采样共用的 UV 通道 */
  uvChannel: PrintUvChannel
  /** 仅统计实际打印三角形的原始 UV 包围框，原始模式下可退化 */
  rawBounds: UvDomain
  /** 实际打印三角形数量 */
  triangleCount: number
  /** 已解析数值映射 */
  mapping: DesignPrintMapping
  /** 解析采用的策略，不代表自动识别物理比例 */
  mappingMode: PrintUvMapping['mode']
  /** 配置逐项来源 */
  sources: {
    /** 逻辑画布尺寸来源 */
    canvas: PrintConfigurationSource
    /** UV 通道来源 */
    uvChannel: PrintConfigurationSource
    /** UV 坐标域来源 */
    uvMapping: PrintConfigurationSource
    /** 纹理上传方向来源 */
    textureFlipY: PrintConfigurationSource
  }
  /** 最终逻辑画布尺寸，单位为像素 */
  canvas: DesignCanvas
  /** 转换后在画布中的打印包围框，不是复杂轮廓蒙版 */
  printableBounds: CanvasBounds
  /** 仅当当前恢复文档与宿主为实际模型提供的内容版本明确一致时为 true，恢复或历史操作后更新 */
  modelRevisionVerified: boolean
  /** 是否按 Schema 2 保存当前设计 */
  usesMappingDocument: boolean
  /** 当前模型与设计恢复的诊断，不包含之前产品的旧诊断 */
  diagnostics: PrintDiagnostic[]
}

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
  /** 设计使用的 UV 通道，默认 0；指定通道不存在时加载失败 */
  uvChannel?: PrintUvChannel
  /** 默认 original；fit-bounds 和 domain 必须主动配置，不修改模型 UV */
  uvMapping?: PrintUvMapping
  /** 调用方提供的不可变模型内容版本，不以模型 URL 代替 */
  modelRevision?: string
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
  /** 二维与三维设计共同使用的 UV 通道 */
  uvChannel: PrintUvChannel
  /** 当前采用的映射策略，实际域通过 getPrintSurfaceInfo 查询 */
  uvMapping: PrintUvMapping
  /** 外层资源系统提供的内容版本 */
  modelRevision?: string
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
  /** 二维显示取景；默认围绕打印区域等比适配，独立于逻辑尺寸、保存数据和输出纹理 */
  editorView?: EditorViewOptions
  /** 二维编辑器的挂载元素或 CSS 选择器 */
  editor: ElementTarget

  /** 三维查看器的挂载元素或 CSS 选择器 */
  viewer: ElementTarget

  /** 二维逻辑宽度，单位为像素；恢复文档和元数据解析后才回退为 1024，上限 8192 */
  editorWidth?: number

  /** 二维逻辑高度，单位为像素；元数据模式下必须与宽度一起提供，总面积不超过 16777216 像素 */
  editorHeight?: number

  /** 初始化时加载的产品配置 */
  product?: ProductConfiguration
  /** 主动读取目标打印节点 extras.customforge，默认 false；不从 UV 推断画布比例 */
  readModelMetadata?: boolean
  /** 在创建画布前校验并恢复 Schema 1/2，模型地址仍由 product 提供 */
  initialDesign?: unknown
  /** 接收初始化、产品切换及设计恢复诊断，异常不会中止加载；诊断同时保存在解析快照中 */
  onDiagnostic?: (diagnostic: PrintDiagnostic) => void

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
 * 未提供 x/y 时围绕实际打印区域居中，必要时等比缩小；显式坐标继续使用逻辑像素
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

  /** 文字编辑框宽度，单位为逻辑像素；默认取打印范围宽度的 60%，过大时等比缩小 */
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
 * 普通图片未提供 x/y 时在实际打印区域居中并等比适配，显式坐标保持逻辑像素语义
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

  /** 图片的逻辑显示宽度，默认取打印范围宽度的 40%，过大时等比缩小 */
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
export interface DesignDocumentV1 {
  /** Schema 版本，当前固定为 1 */
  version: 1

  /** 保存设计时使用的逻辑画布尺寸 */
  canvas: DesignCanvas

  /** 按渲染层级从后到前排列的可编辑对象 */
  objects: DesignObject[]
}

/** 保存已解析映射的设计文档，模型文件与基础纹理由宿主管理 */
export interface DesignDocumentV2 {
  /** Schema 版本，固定为 2 */
  version: 2
  /** 图层逻辑像素所依据的尺寸 */
  canvas: DesignCanvas
  /** 数值域、目标节点、通道和方向，恢复时必须保持一致 */
  printMapping: DesignPrintMapping
  /** 按从后到前顺序排列的设计对象 */
  objects: DesignObject[]
}

/** Schema 1 保持旧行为；Schema 2 同时保存映射，不包含模型 URL 或模型二进制 */
export type DesignDocument = DesignDocumentV1 | DesignDocumentV2

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

/** 二维显示取景配置，不迁移对象或改变设计映射 */
export interface EditorViewOptions {
  /** 取景对象，默认 print-area；canvas 表示整张逻辑纹理 */
  fit?: 'print-area' | 'canvas'
  /** 取景范围每侧比例留白，0～0.5，默认 0.06 */
  paddingRatio?: number
  /** 距容器边缘的最小安全距离，CSS 像素，默认 16 */
  minPadding?: number
  /** 是否允许放大小区域，默认 true；数值保护上限为 128 倍 */
  allowUpscale?: boolean
}

/** 二维显示状态快照，所有视图数值均使用 CSS 像素而非设备像素 */
export interface EditorViewState extends Required<EditorViewOptions> {
  /** 保存与输出使用的逻辑纹理尺寸 */
  designCanvas: DesignCanvas
  /** 最近观测的容器尺寸，隐藏时可能为零 */
  viewport: DesignCanvas
  /** 真实有效打印范围；空区域不会替换为历史整画布回退 */
  printableBounds: CanvasBounds
  /** 横纵共用缩放倍数，隐藏时保留最后有效值 */
  zoom: number
  /** 逻辑坐标到显示坐标的横向平移，允许为负 */
  offsetX: number
  /** 逻辑坐标到显示坐标的纵向平移，允许为负 */
  offsetY: number
  /** 是否取得有效容器和取景区域，回退或隐藏时为 false */
  ready: boolean
  /** 是否因极小区域触发 128 倍显示上限 */
  zoomLimited: boolean
  /** 无有效区域时仍显示整画布，并明确标记回退原因 */
  fallback: 'none' | 'invalid-print-area'
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
  /** 当前二维显示取景，独立于持久化设计文档 */
  editorView: EditorViewState
  /** 当前补全默认值后的产品配置 */
  product: ResolvedProductConfiguration

  /** 当前逻辑画布尺寸 */
  canvas: DesignCanvas

  /** 当前产品 UV 在逻辑画布中的可打印包围框 */
  printableBounds: CanvasBounds
  /** 当前打印面解析结果及诊断 */
  printSurface: PrintSurfaceInfo

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
  /** 二维容器或取景变化，不表示设计修改，不写入历史或触发纹理上传 */
  editorviewchange: EditorViewState
  /** 成功解析产品后发送的单条诊断，也可通过解析快照读取初始化诊断 */
  diagnostic: PrintDiagnostic
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
