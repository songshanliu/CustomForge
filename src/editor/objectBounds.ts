/** 参与画布边界计算的轴对齐包围盒 */
export interface ObjectBounds {
  /** 包围盒左边缘的画布横坐标 */
  left: number

  /** 包围盒上边缘的画布纵坐标 */
  top: number

  /** 包围盒宽度 */
  width: number

  /** 包围盒高度 */
  height: number
}

/** 将对象包围盒移回画布所需的偏移量 */
export interface ContainmentOffset {
  /** 应加到对象横坐标的偏移量 */
  x: number

  /** 应加到对象纵坐标的偏移量 */
  y: number
}

/**
 * 计算对象完整进入画布所需的最大等比缩放系数
 *
 * @param bounds 对象当前的轴对齐包围盒
 * @param canvasWidth 画布逻辑宽度
 * @param canvasHeight 画布逻辑高度
 * @returns 不大于 1 的缩放系数，对象已经可容纳时返回 1
 */
export function calculateContainmentScale(
  bounds: ObjectBounds,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const widthScale = bounds.width > canvasWidth ? canvasWidth / bounds.width : 1
  const heightScale = bounds.height > canvasHeight ? canvasHeight / bounds.height : 1
  return Math.min(widthScale, heightScale, 1)
}

/**
 * 计算可容纳对象移回画布所需的平移距离
 *
 * 调用前应先确保包围盒不大于画布，否则无法同时满足两侧边界
 *
 * @param bounds 对象当前的轴对齐包围盒
 * @param canvasWidth 画布逻辑宽度
 * @param canvasHeight 画布逻辑高度
 * @returns 应叠加到对象位置的画布坐标偏移量
 */
export function calculateContainmentOffset(
  bounds: ObjectBounds,
  canvasWidth: number,
  canvasHeight: number,
): ContainmentOffset {
  const x =
    bounds.left < 0
      ? -bounds.left
      : Math.min(0, canvasWidth - bounds.left - bounds.width)
  const y =
    bounds.top < 0
      ? -bounds.top
      : Math.min(0, canvasHeight - bounds.top - bounds.height)

  return { x, y }
}
