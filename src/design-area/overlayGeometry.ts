import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  type Mesh,
} from 'three'
import type { SurfaceCandidate } from '../processing/types'

const MAX_XATLAS_VERTICES = 65_535

/**
 * 从源 Mesh 复制候选三角形并压缩为可交给 xatlas 的独立索引几何体
 *
 * 返回值不共享源 Mesh 的属性 Buffer，xatlas 可以安全增删顶点
 *
 * @param source 候选区域所属的静态 Mesh
 * @param candidate 包含源三角形编号的自动候选
 * @returns 只包含候选表面的独立索引几何体
 * @throws 源几何无效或候选顶点超过当前 xatlas 包装器上限时抛出错误
 */
export function createCandidateOverlayGeometry(
  source: Mesh,
  candidate: SurfaceCandidate,
): BufferGeometry {
  const sourceGeometry = source.geometry
  const position = sourceGeometry.getAttribute('position')
  const normal = sourceGeometry.getAttribute('normal')
  if (!position) {
    throw new Error('Design area source does not contain positions: ' + candidate.meshId)
  }

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const compactIndices = new Map<number, number>()
  const sourceVertexAt = (triangleIndex: number, corner: number): number => {
    const indexOffset = triangleIndex * 3 + corner
    return sourceGeometry.index
      ? sourceGeometry.index.getX(indexOffset)
      : indexOffset
  }

  for (const triangleIndex of candidate.triangleIndices) {
    for (let corner = 0; corner < 3; corner += 1) {
      const sourceVertex = sourceVertexAt(triangleIndex, corner)
      if (
        !Number.isInteger(sourceVertex) ||
        sourceVertex < 0 ||
        sourceVertex >= position.count
      ) {
        throw new Error('Design area contains an invalid source triangle: ' + candidate.id)
      }
      let compactIndex = compactIndices.get(sourceVertex)
      if (compactIndex === undefined) {
        compactIndex = compactIndices.size
        if (compactIndex >= MAX_XATLAS_VERTICES) {
          throw new Error(
            'Design area exceeds the ' +
              MAX_XATLAS_VERTICES +
              ' vertex parameterization limit',
          )
        }
        compactIndices.set(sourceVertex, compactIndex)
        positions.push(
          position.getX(sourceVertex),
          position.getY(sourceVertex),
          position.getZ(sourceVertex),
        )
        if (normal) {
          normals.push(
            normal.getX(sourceVertex),
            normal.getY(sourceVertex),
            normal.getZ(sourceVertex),
          )
        }
      }
      indices.push(compactIndex)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(new Uint16BufferAttribute(indices, 1))
  if (normal && normals.length === positions.length) {
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  } else {
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

