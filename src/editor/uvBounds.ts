import type { UvLayout } from '../core/uv'
import type { ObjectBounds } from './objectBounds'

function fullCanvasBounds(width: number, height: number): ObjectBounds {
  return { left: 0, top: 0, width, height }
}

/**
 * 将 UV 三角形的坐标范围转换为逻辑画布包围框
 *
 * UV 坐标会限制在 0 到 1 之间；布局为空、无效或退化时回退到整张画布
 *
 * @param layout 当前可打印 Mesh 的 UV 布局
 * @param flipY 是否按照垂直翻转后的纹理方向计算
 * @param canvasWidth 逻辑画布宽度
 * @param canvasHeight 逻辑画布高度
 * @returns 当前 UV 可打印区域在逻辑画布中的轴对齐包围框
 */
export function calculateUvCanvasBounds(
  layout: UvLayout,
  flipY: boolean,
  canvasWidth: number,
  canvasHeight: number,
): ObjectBounds {
  const coordinates = layout.triangleCoordinates
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY

  for (let index = 0; index + 1 < coordinates.length; index += 2) {
    const u = coordinates[index]
    const v = coordinates[index + 1]
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      continue
    }

    const x = Math.min(Math.max(u, 0), 1) * canvasWidth
    const normalizedY = flipY ? 1 - v : v
    const y = Math.min(Math.max(normalizedY, 0), 1) * canvasHeight
    minimumX = Math.min(minimumX, x)
    minimumY = Math.min(minimumY, y)
    maximumX = Math.max(maximumX, x)
    maximumY = Math.max(maximumY, y)
  }

  const width = maximumX - minimumX
  const height = maximumY - minimumY
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return fullCanvasBounds(canvasWidth, canvasHeight)
  }

  return { left: minimumX, top: minimumY, width, height }
}
