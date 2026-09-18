import { Mesh } from 'three'
import type { UvLayout } from '../core/uv'

interface GeometryRange {
  start: number
  count: number
}

interface UvEdge {
  coordinates: [number, number, number, number]
  occurrences: number
}

const UV_EDGE_PRECISION = 1_000_000

function createPointKey(u: number, v: number): string {
  return `${Math.round(u * UV_EDGE_PRECISION)},${Math.round(v * UV_EDGE_PRECISION)}`
}

function extractBoundaryCoordinates(
  triangleCoordinates: Float32Array,
): Float32Array {
  const edges = new Map<string, UvEdge>()

  for (let index = 0; index < triangleCoordinates.length; index += 6) {
    const points = [
      [triangleCoordinates[index], triangleCoordinates[index + 1]],
      [triangleCoordinates[index + 2], triangleCoordinates[index + 3]],
      [triangleCoordinates[index + 4], triangleCoordinates[index + 5]],
    ] as const

    for (const [startIndex, endIndex] of [[0, 1], [1, 2], [2, 0]] as const) {
      const start = points[startIndex]
      const end = points[endIndex]
      const startKey = createPointKey(start[0], start[1])
      const endKey = createPointKey(end[0], end[1])
      const edgeKey = startKey < endKey
        ? `${startKey}|${endKey}`
        : `${endKey}|${startKey}`
      const edge = edges.get(edgeKey)

      if (edge) {
        edge.occurrences += 1
      } else {
        edges.set(edgeKey, {
          coordinates: [start[0], start[1], end[0], end[1]],
          occurrences: 1,
        })
      }
    }
  }

  return new Float32Array(
    [...edges.values()]
      .filter((edge) => edge.occurrences === 1)
      .flatMap((edge) => edge.coordinates),
  )
}

/**
 * 提取目标 Mesh 第一个材质槽使用的 UV 三角形
 *
 * @param mesh 接收实时纹理的目标 Mesh
 * @returns 保持模型原始 V 方向的 UV 三角形和外边界布局
 * @throws Mesh 缺少 UV、面数据无效或第一个材质槽没有三角形时抛出错误
 */
export function extractUvLayout(mesh: Mesh): UvLayout {
  const geometry = mesh.geometry
  const uv = geometry.getAttribute('uv')
  if (!uv) {
    throw new Error(`Customizable mesh does not contain UV coordinates: ${mesh.name}`)
  }

  const index = geometry.getIndex()
  const elementCount = index?.count ?? uv.count
  const ranges: GeometryRange[] =
    Array.isArray(mesh.material) && geometry.groups.length > 0
      ? geometry.groups
          .filter((group) => (group.materialIndex ?? 0) === 0)
          .map(({ start, count }) => ({ start, count }))
      : [{ start: 0, count: elementCount }]
  const coordinateCount = ranges.reduce((total, range) => {
    if (
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.count) ||
      range.start < 0 ||
      range.count < 0 ||
      range.start + range.count > elementCount ||
      range.count % 3 !== 0
    ) {
      throw new Error(`Customizable mesh has invalid triangle groups: ${mesh.name}`)
    }
    return total + range.count * 2
  }, 0)

  if (coordinateCount === 0) {
    throw new Error(`Customizable mesh has no triangles in its first material slot: ${mesh.name}`)
  }

  const triangleCoordinates = new Float32Array(coordinateCount)
  let targetIndex = 0
  for (const range of ranges) {
    for (let offset = range.start; offset < range.start + range.count; offset += 1) {
      const vertexIndex = index ? index.getX(offset) : offset
      const u = uv.getX(vertexIndex)
      const v = uv.getY(vertexIndex)
      if (!Number.isFinite(u) || !Number.isFinite(v)) {
        throw new Error(`Customizable mesh has invalid UV coordinates: ${mesh.name}`)
      }
      triangleCoordinates[targetIndex] = u
      triangleCoordinates[targetIndex + 1] = v
      targetIndex += 2
    }
  }

  return {
    triangleCoordinates,
    boundaryCoordinates: extractBoundaryCoordinates(triangleCoordinates),
  }
}
