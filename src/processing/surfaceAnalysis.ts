import type {
  SurfaceAnalysisOptions,
  SurfaceAnalysisProgress,
  SurfaceAnalysisResult,
  SurfaceCandidate,
  SurfaceGeometrySnapshot,
  SurfaceProjectionFrame,
} from './types'

type Vector = [number, number, number]

interface TriangleRecord {
  area: number
  centroid: Vector
  indices: [number, number, number]
  materialIndex: number
  neighbors: number[]
  normal: Vector
  sourceTriangleIndex: number
}

interface RegionRecord {
  area: number
  candidate: SurfaceCandidate
}

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function length(vector: Vector): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function normalize(vector: Vector): Vector {
  const magnitude = length(vector)
  if (magnitude === 0) {
    return [0, 0, 1]
  }
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude]
}

function addScaled(target: Vector, source: Vector, scale: number): void {
  target[0] += source[0] * scale
  target[1] += source[1] * scale
  target[2] += source[2] * scale
}

function vertex(snapshot: SurfaceGeometrySnapshot, index: number): Vector {
  const offset = index * 3
  return [
    snapshot.positions[offset],
    snapshot.positions[offset + 1],
    snapshot.positions[offset + 2],
  ]
}

function buildTriangles(snapshot: SurfaceGeometrySnapshot): {
  triangles: TriangleRecord[]
  totalArea: number
} {
  const boundsMin: Vector = [Infinity, Infinity, Infinity]
  const boundsMax: Vector = [-Infinity, -Infinity, -Infinity]
  for (let offset = 0; offset < snapshot.positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      boundsMin[axis] = Math.min(boundsMin[axis], snapshot.positions[offset + axis])
      boundsMax[axis] = Math.max(boundsMax[axis], snapshot.positions[offset + axis])
    }
  }
  const diagonal = length(subtract(boundsMax, boundsMin))
  const weldTolerance = Math.max(diagonal * 1e-6, 1e-8)
  const weldedIds = new Uint32Array(snapshot.positions.length / 3)
  const weldedByPosition = new Map<string, number>()
  let weldedSequence = 0

  for (let vertexIndex = 0; vertexIndex < weldedIds.length; vertexIndex += 1) {
    const point = vertex(snapshot, vertexIndex)
    const key = point
      .map((value) => Math.round(value / weldTolerance))
      .join(':')
    let weldedId = weldedByPosition.get(key)
    if (weldedId === undefined) {
      weldedId = weldedSequence
      weldedSequence += 1
      weldedByPosition.set(key, weldedId)
    }
    weldedIds[vertexIndex] = weldedId
  }

  const triangles: TriangleRecord[] = []
  let totalArea = 0
  for (
    let indexOffset = 0;
    indexOffset < snapshot.indices.length;
    indexOffset += 3
  ) {
    const sourceTriangleIndex = indexOffset / 3
    const indices: [number, number, number] = [
      snapshot.indices[indexOffset],
      snapshot.indices[indexOffset + 1],
      snapshot.indices[indexOffset + 2],
    ]
    const a = vertex(snapshot, indices[0])
    const b = vertex(snapshot, indices[1])
    const c = vertex(snapshot, indices[2])
    const areaVector = cross(subtract(b, a), subtract(c, a))
    const doubledArea = length(areaVector)
    if (!Number.isFinite(doubledArea) || doubledArea <= Number.EPSILON) {
      continue
    }
    const area = doubledArea * 0.5
    totalArea += area
    triangles.push({
      area,
      centroid: [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ],
      indices,
      materialIndex: snapshot.materialIndices[sourceTriangleIndex] ?? 0,
      neighbors: [],
      normal: normalize(areaVector),
      sourceTriangleIndex,
    })
  }

  const edgeOwners = new Map<string, number[]>()
  for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex += 1) {
    const triangle = triangles[triangleIndex]
    const welded = triangle.indices.map((index) => weldedIds[index])
    for (const [from, to] of [[welded[0], welded[1]], [welded[1], welded[2]], [welded[2], welded[0]]]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`
      const owners = edgeOwners.get(key)
      if (owners) {
        owners.push(triangleIndex)
      } else {
        edgeOwners.set(key, [triangleIndex])
      }
    }
  }
  for (const owners of edgeOwners.values()) {
    if (owners.length !== 2) {
      continue
    }
    const [first, second] = owners
    triangles[first].neighbors.push(second)
    triangles[second].neighbors.push(first)
  }

  return { triangles, totalArea }
}

function createProjection(
  snapshot: SurfaceGeometrySnapshot,
  triangles: TriangleRecord[],
  region: number[],
  averageNormal: Vector,
  centroid: Vector,
): { compactness: number; frame: SurfaceProjectionFrame } {
  const reference: Vector = Math.abs(averageNormal[1]) < 0.9
    ? [0, 1, 0]
    : [1, 0, 0]
  const initialTangent = normalize(cross(reference, averageNormal))
  const initialBitangent = normalize(cross(averageNormal, initialTangent))
  let covarianceXX = 0
  let covarianceXY = 0
  let covarianceYY = 0
  const uniqueVertices = new Set<number>()
  for (const triangleIndex of region) {
    triangles[triangleIndex].indices.forEach((index) => uniqueVertices.add(index))
  }
  for (const vertexIndex of uniqueVertices) {
    const relative = subtract(vertex(snapshot, vertexIndex), centroid)
    const x = dot(relative, initialTangent)
    const y = dot(relative, initialBitangent)
    covarianceXX += x * x
    covarianceXY += x * y
    covarianceYY += y * y
  }
  const angle = 0.5 * Math.atan2(
    covarianceXY * 2,
    covarianceXX - covarianceYY,
  )
  const tangent: Vector = normalize([
    initialTangent[0] * Math.cos(angle) + initialBitangent[0] * Math.sin(angle),
    initialTangent[1] * Math.cos(angle) + initialBitangent[1] * Math.sin(angle),
    initialTangent[2] * Math.cos(angle) + initialBitangent[2] * Math.sin(angle),
  ])
  const bitangent = normalize(cross(averageNormal, tangent))
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const vertexIndex of uniqueVertices) {
    const relative = subtract(vertex(snapshot, vertexIndex), centroid)
    const x = dot(relative, tangent)
    const y = dot(relative, bitangent)
    const z = dot(relative, averageNormal)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const width = Math.max(maxX - minX, 1e-6)
  const height = Math.max(maxY - minY, 1e-6)
  const depth = Math.max(maxZ - minZ, Math.min(width, height) * 0.02, 1e-6)
  let projectedArea = 0
  for (const triangleIndex of region) {
    const triangle = triangles[triangleIndex]
    projectedArea += triangle.area * Math.abs(dot(triangle.normal, averageNormal))
  }
  return {
    compactness: Math.min(projectedArea / (width * height), 1),
    frame: {
      positionX: centroid[0],
      positionY: centroid[1],
      positionZ: centroid[2],
      tangentX: tangent[0],
      tangentY: tangent[1],
      tangentZ: tangent[2],
      normalX: averageNormal[0],
      normalY: averageNormal[1],
      normalZ: averageNormal[2],
      width: width * 1.08,
      height: height * 1.08,
      depth: depth * 1.5,
    },
  }
}

function analyzeSnapshot(
  snapshot: SurfaceGeometrySnapshot,
  options: SurfaceAnalysisOptions,
): { regions: RegionRecord[]; totalArea: number; triangleCount: number } {
  const { triangles, totalArea } = buildTriangles(snapshot)
  const visited = new Uint8Array(triangles.length)
  const adjacentThreshold = Math.cos(options.adjacentAngleDegrees * Math.PI / 180)
  const normalThreshold = Math.cos(options.normalDeviationDegrees * Math.PI / 180)
  const regions: RegionRecord[] = []

  for (let seed = 0; seed < triangles.length; seed += 1) {
    if (visited[seed]) {
      continue
    }
    const queue = [seed]
    const region: number[] = []
    const weightedNormal: Vector = [0, 0, 0]
    const weightedCentroid: Vector = [0, 0, 0]
    let area = 0
    visited[seed] = 1

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const triangleIndex = queue[cursor]
      const triangle = triangles[triangleIndex]
      region.push(triangleIndex)
      area += triangle.area
      addScaled(weightedNormal, triangle.normal, triangle.area)
      addScaled(weightedCentroid, triangle.centroid, triangle.area)
      const currentAverage = normalize(weightedNormal)

      for (const neighborIndex of triangle.neighbors) {
        if (visited[neighborIndex]) {
          continue
        }
        const neighbor = triangles[neighborIndex]
        if (neighbor.materialIndex !== triangle.materialIndex) {
          continue
        }
        if (dot(triangle.normal, neighbor.normal) < adjacentThreshold) {
          continue
        }
        if (dot(currentAverage, neighbor.normal) < normalThreshold) {
          continue
        }
        visited[neighborIndex] = 1
        queue.push(neighborIndex)
      }
    }

    if (area <= 0 || totalArea <= 0) {
      continue
    }
    const areaRatio = area / totalArea
    if (areaRatio < options.minimumAreaRatio) {
      continue
    }
    const averageNormal = normalize(weightedNormal)
    const centroid: Vector = [
      weightedCentroid[0] / area,
      weightedCentroid[1] / area,
      weightedCentroid[2] / area,
    ]
    const normalConsistency = Math.min(length(weightedNormal) / area, 1)
    const projection = createProjection(
      snapshot,
      triangles,
      region,
      averageNormal,
      centroid,
    )
    const sourceTriangleIndices = region
      .map((triangleIndex) => triangles[triangleIndex].sourceTriangleIndex)
      .sort((first, second) => first - second)
    const firstTriangle = sourceTriangleIndices[0]
    regions.push({
      area,
      candidate: {
        id: `${snapshot.meshId}:surface-${firstTriangle}`,
        meshId: snapshot.meshId,
        triangleIndices: Uint32Array.from(sourceTriangleIndices),
        score: 0,
        areaRatio,
        normalConsistency,
        compactness: projection.compactness,
        projection: projection.frame,
      },
    })
  }

  return { regions, totalArea, triangleCount: triangles.length }
}

/**
 * 分析几何快照并返回适合局部平面投影的设计区域候选
 *
 * @param snapshots 一个产品内的全部静态 Mesh 快照
 * @param options 分区阈值和返回数量
 * @param onProgress 每完成一个 Mesh 后调用的可选进度监听器
 * @returns 按面积、法线一致性和紧凑度评分的稳定候选列表
 */
export function analyzeSurfaceSnapshots(
  snapshots: SurfaceGeometrySnapshot[],
  options: SurfaceAnalysisOptions,
  onProgress?: (progress: SurfaceAnalysisProgress) => void,
): SurfaceAnalysisResult {
  const regions: RegionRecord[] = []
  let surfaceArea = 0
  let triangleCount = 0

  snapshots.forEach((snapshot, index) => {
    const result = analyzeSnapshot(snapshot, options)
    regions.push(...result.regions)
    surfaceArea += result.totalArea
    triangleCount += result.triangleCount
    onProgress?.({
      completedMeshes: index + 1,
      totalMeshes: snapshots.length,
    })
  })

  const maximumArea = regions.reduce(
    (maximum, { area }) => Math.max(maximum, area),
    1,
  )
  for (const region of regions) {
    const areaScore = region.area / maximumArea
    region.candidate.score = Math.min(
      areaScore * 0.42 +
      region.candidate.normalConsistency * 0.38 +
      region.candidate.compactness * 0.2,
      1,
    )
    region.candidate.areaRatio = surfaceArea > 0
      ? region.area / surfaceArea
      : 0
  }

  const candidates = regions
    .map(({ candidate }) => candidate)
    .sort((first, second) =>
      second.score - first.score || first.id.localeCompare(second.id),
    )
    .slice(0, options.maxAreas)

  return { candidates, triangleCount, surfaceArea }
}
