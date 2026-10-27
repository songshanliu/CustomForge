import type { UvLayout } from '../core/uv'
import type { EditorViewState } from '../core/types'

interface UvOverlayAppearance {
  fill: string
  boundary: string
}

/** 模型变化时创建的逻辑坐标 UV 路径，容器变化时复用 */
export interface UvOverlayPaths {
  /** 三角形区域路径 */
  fill: Path2D
  /** 外边界路径 */
  boundary: Path2D
}

/** 将 UV 布局缓存为逻辑路径，保持既有方向和原始模式的辅助线约定 */
export function createUvOverlayPaths(layout: UvLayout, flipY: boolean, width: number, height: number, legacyClamping: boolean): UvOverlayPaths {
  const paths = { fill: new Path2D(), boundary: new Path2D() }
  const x = (u: number) => legacyClamping ? Math.min(Math.max(u * width, 1), width - 1) : u * width
  const y = (v: number) => {
    const value = (flipY ? 1 - v : v) * height
    return legacyClamping ? Math.min(Math.max(value, 1), height - 1) : value
  }
  for (let i = 0; i < layout.triangleCoordinates.length; i += 6) {
    const a = layout.triangleCoordinates
    paths.fill.moveTo(x(a[i]), y(a[i + 1]))
    paths.fill.lineTo(x(a[i + 2]), y(a[i + 3]))
    paths.fill.lineTo(x(a[i + 4]), y(a[i + 5]))
  }
  for (let i = 0; i < layout.boundaryCoordinates.length; i += 4) {
    const a = layout.boundaryCoordinates
    paths.boundary.moveTo(x(a[i]), y(a[i + 1]))
    paths.boundary.lineTo(x(a[i + 2]), y(a[i + 3]))
  }
  return paths
}

/** 将缓存路径应用同一取景和 DPR，边界线宽与虚线保持 CSS 像素大小 */
export function renderUvOverlay(context: CanvasRenderingContext2D, paths: UvOverlayPaths, state: EditorViewState, dpr: number, appearance: UvOverlayAppearance): void {
  context.save()
  try {
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    const { zoom, offsetX, offsetY, designCanvas } = state
    context.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offsetX, dpr * offsetY)
    context.beginPath()
    context.rect(0, 0, designCanvas.width, designCanvas.height)
    context.clip()
    context.fillStyle = appearance.fill
    context.globalAlpha = 0.012
    context.fill(paths.fill)
    context.globalAlpha = 0.28
    context.strokeStyle = appearance.boundary
    context.lineWidth = 1 / zoom
    context.setLineDash([6 / zoom, 6 / zoom])
    context.stroke(paths.boundary)
  } finally {
    context.restore()
  }
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
 * @param legacyClamping 是否保留原始模式的逐点边框收缩，新模式由 Canvas 自然裁剪
 */
export function drawUvOverlay(
  context: CanvasRenderingContext2D,
  layout: UvLayout,
  flipY: boolean,
  width: number,
  height: number,
  appearance: UvOverlayAppearance,
  legacyClamping = true,
): void {
  const { triangleCoordinates, boundaryCoordinates } = layout
  const canvasX = (u: number) =>
    legacyClamping ? Math.min(Math.max(u * width, 1), width - 1) : u * width
  const canvasY = (v: number) =>
    legacyClamping ? Math.min(
      Math.max((flipY ? 1 - v : v) * height, 1),
      height - 1,
    ) : (flipY ? 1 - v : v) * height

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
