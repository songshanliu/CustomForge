import type { UvLayout } from '../core/uv'

interface UvOverlayAppearance {
  fill: string
  boundary: string
}

/**
 * 将 UV 可打印区域和外边界绘制到独立辅助画布
 *
 * 三角形保持为开放子路径，由单次 `fill()` 按 Canvas 规范隐式闭合，
 * 避免高面数模型为每个三角形同步执行 `closePath()`
 *
 * @param context UV 辅助画布的二维上下文
 * @param layout 当前目标 Mesh 的 UV 三角形和外边界
 * @param flipY 是否按照垂直翻转后的纹理方向显示
 * @param width 逻辑画布宽度，单位为像素
 * @param height 逻辑画布高度，单位为像素
 * @param appearance 辅助填充和边界颜色
 */
export function drawUvOverlay(
  context: CanvasRenderingContext2D,
  layout: UvLayout,
  flipY: boolean,
  width: number,
  height: number,
  appearance: UvOverlayAppearance,
): void {
  const { triangleCoordinates, boundaryCoordinates } = layout
  const canvasX = (u: number) =>
    Math.min(Math.max(u * width, 1), width - 1)
  const canvasY = (v: number) =>
    Math.min(
      Math.max((flipY ? 1 - v : v) * height, 1),
      height - 1,
    )

  context.save()
  try {
    context.beginPath()
    for (let index = 0; index < triangleCoordinates.length; index += 6) {
      context.moveTo(
        canvasX(triangleCoordinates[index]),
        canvasY(triangleCoordinates[index + 1]),
      )
      context.lineTo(
        canvasX(triangleCoordinates[index + 2]),
        canvasY(triangleCoordinates[index + 3]),
      )
      context.lineTo(
        canvasX(triangleCoordinates[index + 4]),
        canvasY(triangleCoordinates[index + 5]),
      )
    }
    context.fillStyle = appearance.fill
    context.globalAlpha = 0.012
    context.fill()

    context.beginPath()
    for (let index = 0; index < boundaryCoordinates.length; index += 4) {
      context.moveTo(
        canvasX(boundaryCoordinates[index]),
        canvasY(boundaryCoordinates[index + 1]),
      )
      context.lineTo(
        canvasX(boundaryCoordinates[index + 2]),
        canvasY(boundaryCoordinates[index + 3]),
      )
    }
    context.globalAlpha = 0.28
    context.strokeStyle = appearance.boundary
    context.lineWidth = 1
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.setLineDash([6, 6])
    context.stroke()
  } finally {
    context.restore()
  }
}
