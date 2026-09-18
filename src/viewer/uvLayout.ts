import { Mesh } from 'three'
import type { UvLayout } from '../core/uv'

interface GeometryRange {
  start: number
  count: number
}

/**
 * 提取目标 Mesh 第一个材质槽使用的 UV 三角形
 *
 * @param mesh 接收实时纹理的目标 Mesh
 * @returns 保持模型原始 V 方向的 UV 三角形布局
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

  return { triangleCoordinates }
}
