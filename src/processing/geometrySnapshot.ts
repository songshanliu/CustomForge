import type { BufferGeometry } from 'three'
import type { SurfaceGeometrySnapshot } from './types'

/**
 * 将 Three.js BufferGeometry 复制为可安全转移到 Worker 的分析快照
 *
 * @param meshId 场景内稳定的 Mesh 路径标识
 * @param geometry 需要分析的三角形几何体
 * @returns 不共享原始渲染 Buffer 的 TypedArray 快照
 * @throws 缺少 position、索引不是三角形或属性包含非有限数值时抛出错误
 */
export function createSurfaceGeometrySnapshot(
  meshId: string,
  geometry: BufferGeometry,
): SurfaceGeometrySnapshot {
  const position = geometry.getAttribute('position')
  if (!position) {
    throw new Error(`Mesh does not contain position coordinates: ${meshId}`)
  }

  const indexCount = geometry.index?.count ?? position.count
  if (indexCount < 3 || indexCount % 3 !== 0) {
    throw new Error(`Mesh must contain triangle geometry: ${meshId}`)
  }

  const positions = new Float32Array(position.count * 3)
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const offset = vertexIndex * 3
    const x = position.getX(vertexIndex)
    const y = position.getY(vertexIndex)
    const z = position.getZ(vertexIndex)
    if (![x, y, z].every(Number.isFinite)) {
      throw new Error(`Mesh contains invalid position coordinates: ${meshId}`)
    }
    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z
  }

  const normal = geometry.getAttribute('normal')
  let normals: Float32Array | undefined
  if (normal && normal.count === position.count) {
    normals = new Float32Array(normal.count * 3)
    for (let vertexIndex = 0; vertexIndex < normal.count; vertexIndex += 1) {
      const offset = vertexIndex * 3
      const x = normal.getX(vertexIndex)
      const y = normal.getY(vertexIndex)
      const z = normal.getZ(vertexIndex)
      if (![x, y, z].every(Number.isFinite)) {
        throw new Error(`Mesh contains invalid normal coordinates: ${meshId}`)
      }
      normals[offset] = x
      normals[offset + 1] = y
      normals[offset + 2] = z
    }
  }

  const indices = new Uint32Array(indexCount)
  for (let index = 0; index < indexCount; index += 1) {
    const vertexIndex = geometry.index ? geometry.index.getX(index) : index
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.count) {
      throw new Error(`Mesh contains an invalid triangle index: ${meshId}`)
    }
    indices[index] = vertexIndex
  }

  const triangleCount = indexCount / 3
  const materialIndices = new Int32Array(triangleCount)
  for (const group of geometry.groups) {
    const firstTriangle = Math.floor(group.start / 3)
    const endTriangle = Math.min(
      Math.ceil((group.start + group.count) / 3),
      triangleCount,
    )
    for (
      let triangleIndex = firstTriangle;
      triangleIndex < endTriangle;
      triangleIndex += 1
    ) {
      materialIndices[triangleIndex] = group.materialIndex ?? 0
    }
  }

  return {
    meshId,
    positions,
    normals,
    indices,
    materialIndices,
  }
}
