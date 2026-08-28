/** 自动表面分析使用的可转移几何快照 */
export interface SurfaceGeometrySnapshot {
  /** 场景内稳定的 Mesh 路径标识 */
  meshId: string

  /** 按顶点顺序排列的局部坐标，每三个数表示一个顶点 */
  positions: Float32Array

  /** 可选局部顶点法线，每三个数表示一个法线 */
  normals?: Float32Array

  /** 三角形顶点索引，每三个索引表示一个三角形 */
  indices: Uint32Array

  /** 每个三角形所属的材质槽索引 */
  materialIndices: Int32Array
}

/** 自动表面候选生成参数 */
export interface SurfaceAnalysisOptions {
  /** 最多返回的候选区域数量 */
  maxAreas: number

  /** 相邻三角形允许的最大二面角，单位为度 */
  adjacentAngleDegrees: number

  /** 区域内三角形相对平均法线的最大偏差，单位为度 */
  normalDeviationDegrees: number

  /** 候选区域最小面积占全部有效表面积的比例 */
  minimumAreaRatio: number
}

/** 候选区域的局部投影框 */
export interface SurfaceProjectionFrame {
  /** 投影中心的局部横坐标 */
  positionX: number

  /** 投影中心的局部纵坐标 */
  positionY: number

  /** 投影中心的局部深度坐标 */
  positionZ: number

  /** 投影横轴的局部横坐标 */
  tangentX: number

  /** 投影横轴的局部纵坐标 */
  tangentY: number

  /** 投影横轴的局部深度坐标 */
  tangentZ: number

  /** 区域平均法线的局部横坐标 */
  normalX: number

  /** 区域平均法线的局部纵坐标 */
  normalY: number

  /** 区域平均法线的局部深度坐标 */
  normalZ: number

  /** 投影框宽度，使用 Mesh 局部单位 */
  width: number

  /** 投影框高度，使用 Mesh 局部单位 */
  height: number

  /** 投影框深度，使用 Mesh 局部单位 */
  depth: number
}

/** 自动识别的内部表面候选 */
export interface SurfaceCandidate {
  /** 在相同模型和处理参数下保持稳定的候选标识 */
  id: string

  /** 候选所属 Mesh 的路径标识 */
  meshId: string

  /** 候选包含的源三角形编号 */
  triangleIndices: Uint32Array

  /** 综合质量评分，范围为 0-1 */
  score: number

  /** 区域面积占全部有效表面积的比例 */
  areaRatio: number

  /** 区域法线一致性，越接近 1 越适合平面投影 */
  normalConsistency: number

  /** 投影轮廓紧凑度，越接近 1 空白越少 */
  compactness: number

  /** 区域局部投影框 */
  projection: SurfaceProjectionFrame
}

/** 自动表面分析结果 */
export interface SurfaceAnalysisResult {
  /** 按评分从高到低排列的候选区域 */
  candidates: SurfaceCandidate[]

  /** 参与分析的有效三角形数量 */
  triangleCount: number

  /** 参与分析的有效模型表面积 */
  surfaceArea: number
}

/** 自动表面分析进度 */
export interface SurfaceAnalysisProgress {
  /** 已处理的 Mesh 数量 */
  completedMeshes: number

  /** 本次任务需要处理的 Mesh 总数 */
  totalMeshes: number
}
