import type { UvLayout } from '../core/uv'
import type { ObjectBounds } from './objectBounds'

function fullCanvasBounds(width: number, height: number): ObjectBounds {
  return { left: 0, top: 0, width, height }
}

/**
 * 计算三角形与设计域真正相交的显示边界，退化和完全域外布局返回空范围
 *
 * 仅在产品布局变化时调用；不采用原始模式的历史整画布回退
 */
export function calculateUvViewBounds(layout: UvLayout, flipY: boolean, width: number, height: number): ObjectBounds {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity
  const coordinates = layout.triangleCoordinates
  for (let index = 0; index + 5 < coordinates.length; index += 6) {
    let polygon = [
      [coordinates[index], coordinates[index + 1]],
      [coordinates[index + 2], coordinates[index + 3]],
      [coordinates[index + 4], coordinates[index + 5]],
    ]
    if (!polygon.every((point) => point.every(Number.isFinite))) continue
    const inside = polygon.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)
    for (const [axis, limit, direction] of inside ? [] : [[0, 0, 1], [0, 1, -1], [1, 0, 1], [1, 1, -1]]) {
      const output: number[][] = []
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length]
        const insideA = direction * (a[axis] - limit) >= 0
        const insideB = direction * (b[axis] - limit) >= 0
        if (insideA) output.push(a)
        if (insideA !== insideB) {
          const t = (limit - a[axis]) / (b[axis] - a[axis])
          output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
        }
      }
      polygon = output
      if (polygon.length < 3) break
    }
    let twiceArea = 0
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]
      twiceArea += a[0] * b[1] - b[0] * a[1]
    }
    if (Math.abs(twiceArea) === 0) continue
    for (const [u, v] of polygon) {
      minU = Math.min(minU, u); maxU = Math.max(maxU, u)
      minV = Math.min(minV, v); maxV = Math.max(maxV, v)
    }
  }
  return Number.isFinite(minU)
    ? { left: minU * width, top: (flipY ? 1 - maxV : minV) * height, width: (maxU - minU) * width, height: (maxV - minV) * height }
    : { left: 0, top: 0, width: 0, height: 0 }
}

/**
 * 将 UV 三角形的坐标范围转换为逻辑画布包围框
 *
 * 输入必须先经过共享映射；原始模式可保留历史退化回退，新模式返回真实空区域
 *
 * @param layout 当前可打印 Mesh 的 UV 布局
 * @param flipY 是否按照垂直翻转后的纹理方向计算
 * @param canvasWidth 逻辑画布宽度
 * @param canvasHeight 逻辑画布高度
 * @param legacyFallback 是否保留旧版全画布回退，默认 true
 * @returns 当前 UV 可打印区域在逻辑画布中的轴对齐包围框
 */
export function calculateUvCanvasBounds(
  layout: UvLayout,
  flipY: boolean,
  canvasWidth: number,
  canvasHeight: number,
  legacyFallback = true,
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
    return legacyFallback ? fullCanvasBounds(canvasWidth, canvasHeight) : { left: 0, top: 0, width: 0, height: 0 }
  }

  return { left: minimumX, top: minimumY, width, height }
}
