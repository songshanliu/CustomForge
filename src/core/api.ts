import type {
  AddImageOptions,
  AddTextOptions,
  CanvasBounds,
  CustomizerEventMap,
  CustomizerEventName,
  CustomizerState,
  DesignCanvas,
  DesignDocument,
  DesignObject,
  EditorViewState,
  ImageDesignObject,
  ProductConfiguration,
  PrintSurfaceInfo,
  ProductViewState,
  ResolvedProductConfiguration,
  TextDesignObject,
  UpdateObjectTransformOptions,
  UpdateTextOptions,
} from './types'

/** 产品定制器事件监听函数 */
export type CustomizerEventListener<K extends CustomizerEventName> = (
  detail: CustomizerEventMap[K],
) => void

/**
 * 与具体 UI 框架无关的产品定制能力契约
 *
 * 消费方可以基于该接口构建自己的工具栏、图层面板、状态提示和页面样式
 * 接口不暴露 Fabric.js 或 Three.js 实例，调用 destroy 后不得继续使用
 */
export interface ProductCustomizerApi {
  /** 订阅核心状态事件并返回取消订阅函数 */
  on<K extends CustomizerEventName>(
    event: K,
    listener: CustomizerEventListener<K>,
  ): () => void

  /** 添加并选中文字，省略 x/y 时适配实际打印范围；显式坐标使用逻辑像素 */
  addText(options?: AddTextOptions): TextDesignObject

  /**
   * 加载、添加并选中图片，返回可持久化对象快照
   *
   * 远程图片必须允许跨域访问；Blob URL 会在加入设计时转换为 Data URL
   * 普通图片省略 x/y 时适配实际打印范围，显式坐标使用逻辑像素
   */
  addImage(options: AddImageOptions): Promise<ImageDesignObject>

  /** 返回产品、画布、对象、选区、历史和视角的独立状态快照 */
  getState(): CustomizerState

  /** 返回当前补全默认值后的产品配置 */
  getProduct(): ResolvedProductConfiguration

  /** 返回当前逻辑画布尺寸 */
  getCanvasSize(): DesignCanvas

  /** 返回当前产品 UV 在逻辑画布中的可打印包围框 */
  getPrintableBounds(): CanvasBounds

  /** 重新测量二维容器并等比取景，不修改对象、设计历史或三维纹理；隐藏时延后 */
  fitEditorView(): void

  /** 返回二维视图独立快照，不暴露 Fabric 矩阵；隐藏或回退状态由 ready 和 fallback 标识 */
  getEditorViewState(): EditorViewState

  /** 返回数值映射、最终尺寸、配置来源及初始化诊断的独立快照 */
  getPrintSurfaceInfo(): PrintSurfaceInfo

  /** 按从后到前顺序返回设计对象快照 */
  getObjects(): DesignObject[]

  /** 返回当前选中对象 ID */
  getSelectedObjectIds(): string[]

  /** 按稳定 ID 选中一个可见对象 */
  selectObject(id: string): boolean

  /** 按稳定 ID 同时选中多个可见对象，空数组表示清除选区 */
  selectObjects(ids: readonly string[]): boolean

  /** 清除当前选区且不修改设计内容 */
  clearSelection(): boolean

  /** 按稳定 ID 删除一个对象 */
  removeObject(id: string): boolean

  /** 将对象移动到从 0 开始的图层索引 */
  moveObject(id: string, index: number): boolean

  /** 将普通图片转换成适配当前 UV 可打印区域的设计背景 */
  setImageAsBackground(id: string): boolean

  /** 修改对象在图层工具中显示的名称 */
  renameObject(id: string, name: string): boolean

  /** 修改对象是否参与二维、三维和导出渲染 */
  setObjectVisibility(id: string, visible: boolean): boolean

  /** 修改对象是否允许通过画布控件交互变换 */
  setObjectLocked(id: string, locked: boolean): boolean

  /**
   * 更新对象中心位置、缩放、旋转和翻转并返回实际结果
   *
   * 坐标使用逻辑画布像素，缩放必须大于零；默认限制出界，背景可通过 objectBoundary.background 允许出血
   * 只修改一轴缩放不会压缩另一轴；边界策略不写入文档，恢复实例须传入相同配置
   */
  updateObjectTransform(
    id: string,
    options: UpdateObjectTransformOptions,
  ): DesignObject | undefined

  /** 更新文字内容和排版属性 */
  updateText(id: string, options: UpdateTextOptions): boolean

  /** 让未锁定文字进入画布内编辑状态 */
  editText(id: string): boolean

  /** 删除当前对象或多选对象 */
  deleteSelected(): boolean

  /** 返回当前版本化 Design JSON 快照，旧配置保存为 Schema 1，新映射保存为 Schema 2 */
  saveDesign(): DesignDocument

  /** 校验并以事务方式恢复 Design JSON，尺寸或数值映射不匹配时拒绝，不迁移对象坐标 */
  loadDesign(value: unknown): Promise<void>

  /** 查询当前是否可以撤销 */
  canUndo(): boolean

  /** 查询当前是否可以重做 */
  canRedo(): boolean

  /** 恢复上一个历史快照 */
  undo(): Promise<boolean>

  /** 恢复下一个历史快照 */
  redo(): Promise<boolean>

  /** 将当前设计设为新的历史起点 */
  clearHistory(): void

  /** 返回不含选择框和 UV 辅助层的 PNG Data URL，Canvas 被跨域资源污染时会抛出安全错误 */
  getTextureDataUrl(): string

  /** 异步返回不含选择框和 UV 辅助层的 PNG Blob，Canvas 被跨域资源污染时会拒绝 Promise */
  getTextureBlob(): Promise<Blob>

  /** 下载当前合成纹理 PNG */
  exportTexture(filename?: string): void

  /** 返回当前三维观察视角 */
  getViewState(): ProductViewState

  /** 恢复三维观察视角并返回实际结果，坐标无效或相机与目标重合时抛出错误 */
  setViewState(state: ProductViewState): ProductViewState

  /** 恢复适配当前模型的默认三维观察视角 */
  resetView(): void

  /**
   * 更换模型、基础纹理与打印映射，远程资源必须允许跨域访问
   *
   * 沿用逻辑画布与对象坐标，成功后重置历史；新产品声明其他尺寸时拒绝
   * 准备失败保留旧状态，后发请求或销毁取消旧提交并以 AbortError 拒绝
   * 意外提交失败会销毁不可用实例并要求重建
   */
  loadProduct(product: ProductConfiguration): Promise<void>

  /** 幂等释放事件、Canvas、观察器、模型解码位图及 WebGL 上下文；销毁后不得继续调用实例 */
  destroy(): void
}
