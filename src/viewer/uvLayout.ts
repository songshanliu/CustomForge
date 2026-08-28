import type { BufferGeometry } from 'three'

const DEFAULT_MAX_SEGMENTS = 16000
const KEY_PRECISION = 100000

/** UV 辅助图中的一条归一化边界线段 */
export interface UvGuideSegment {
  /** 起点 U 坐标 */
  u1: number

  /** 起点 V 坐标 */
  v1: number

  /** 终点 U 坐标 */
  u2: number

  /** 终点 V 坐标 */
  v2: number
}

/** 从目标 Mesh 提取的 UV 岛边界 */
export interface UvGuideLayout {
  /** 需要绘制的 UV 岛边界线段 */
  segments: UvGuideSegment[]

  /** 是否因边界数量超过上限而进行了抽样 */
  simplified: boolean
}

interface EdgeRecord {
  count: number
  segment: UvGuideSegment
}

function quantize(value: number): number {
  return Math.round(value * KEY_PRECISION)
}

/**
 * 从三角形 BufferGeometry 提取 UV 岛边界
 *
 * 共享 UV 边会成对抵消，只保留岛边缘和接缝；位置坐标参与键值计算，
 * 避免两个互不相干但恰好重叠的 UV 岛错误抵消
 *
 * @param geometry 包含 position 和 uv Attribute 的三角形几何体
 * @param maxSegments 返回的最大边界线段数，超出时均匀抽样
 * @returns 可直接绘制到归一化纹理空间的边界数据
 * @throws 线段上限无效、缺少 UV、三角形数据无效或 UV 含非有限数值时抛出错误
 */
export function extractUvGuideLayout(
  geometry: BufferGeometry,
  maxSegments = DEFAULT_MAX_SEGMENTS,
): UvGuideLayout {
  if (!Number.isInteger(maxSegments) || maxSegments < 1) {
    throw new RangeError('maxSegments must be a positive integer')
  }

  const uv = geometry.getAttribute('uv')
  const position = geometry.getAttribute('position')
  if (!uv) {
    throw new Error('Customizable mesh does not contain UV coordinates')
  }

  const vertexCount = geometry.index?.count ?? uv.count
  if (vertexCount < 3 || vertexCount % 3 !== 0) {
    throw new Error('Customizable mesh must contain triangle geometry')
  }

  const edges = new Map<string, EdgeRecord>()
  const vertexKeys = new Map<number, string>()
  const vertexKey = (vertexIndex: number): string => {
    const cached = vertexKeys.get(vertexIndex)
    if (cached !== undefined) {
      return cached
    }

    const values = [quantize(uv.getX(vertexIndex)), quantize(uv.getY(vertexIndex))]
    if (position) {
      values.push(
        quantize(position.getX(vertexIndex)),
        quantize(position.getY(vertexIndex)),
        quantize(position.getZ(vertexIndex)),
      )
    }
    const key = values.join(':')
    vertexKeys.set(vertexIndex, key)
    return key
  }
  const vertexIndexAt = (index: number): number =>
    geometry.index ? geometry.index.getX(index) : index

  for (let index = 0; index < vertexCount; index += 3) {
    const vertices = [
      vertexIndexAt(index),
      vertexIndexAt(index + 1),
      vertexIndexAt(index + 2),
    ]
    for (const [fromOffset, toOffset] of [[0, 1], [1, 2], [2, 0]]) {
      const from = vertices[fromOffset]
      const to = vertices[toOffset]
      const u1 = uv.getX(from)
      const v1 = uv.getY(from)
      const u2 = uv.getX(to)
      const v2 = uv.getY(to)
      if (![u1, v1, u2, v2].every(Number.isFinite)) {
        throw new Error('Customizable mesh contains invalid UV coordinates')
      }

      const fromKey = vertexKey(from)
      const toKey = vertexKey(to)
      const key = fromKey < toKey
        ? `${fromKey}|${toKey}`
        : `${toKey}|${fromKey}`
      const existing = edges.get(key)
      if (existing) {
        existing.count += 1
      } else {
        edges.set(key, { count: 1, segment: { u1, v1, u2, v2 } })
      }
    }
  }

  const boundaries: UvGuideSegment[] = []
  for (const { count, segment } of edges.values()) {
    if (count === 1) {
      boundaries.push(segment)
    }
  }
  if (boundaries.length <= maxSegments) {
    return { segments: boundaries, simplified: false }
  }

  const step = Math.ceil(boundaries.length / maxSegments)
  const segments: UvGuideSegment[] = []
  for (
    let index = 0;
    index < boundaries.length && segments.length < maxSegments;
    index += step
  ) {
    segments.push(boundaries[index])
  }
  return {
    segments,
    simplified: true,
  }
}
