import { ActiveSelection, Point, controlsUtils, type FabricObject, type Transform } from 'fabric'
import type { ObjectBoundaryOptions } from '../core/types'

/** 校验创建时的对象边界策略，缺省背景仍限制在逻辑画布内 */
export function normalizeObjectBoundaryOptions(options: ObjectBoundaryOptions = {}): Required<ObjectBoundaryOptions> {
  if (options.background !== undefined && !['contain', 'overflow'].includes(options.background)) {
    throw new TypeError('objectBoundary.background must be contain or overflow')
  }
  return { background: options.background ?? 'contain' }
}

/** 一次变换的独立几何快照，坐标属于对象所在平面 */
export interface ObjectGeometry {
  /** 对象原点横坐标 */
  left: number
  /** 对象原点纵坐标 */
  top: number
  /** 横向缩放 */
  scaleX: number
  /** 纵向缩放 */
  scaleY: number
  /** 顺时针角度 */
  angle: number
  /** 横向倾斜角 */
  skewX: number
  /** 纵向倾斜角 */
  skewY: number
  /** 横向翻转 */
  flipX: boolean
  /** 纵向翻转 */
  flipY: boolean
  /** 未缩放宽度 */
  width: number
  /** 未缩放高度 */
  height: number
}

/** 捕获用于手势重放、有限数校验和失败恢复的几何状态 */
export function captureGeometry(object: FabricObject): ObjectGeometry {
  const { left, top, scaleX, scaleY, angle, skewX, skewY, flipX, flipY, width, height } = object
  return { left, top, scaleX, scaleY, angle, skewX, skewY, flipX, flipY, width, height }
}

/** 判断几何与实时世界坐标是否有限，拒绝不可恢复的零缩放 */
export function validGeometry(object: FabricObject): boolean {
  const geometry = captureGeometry(object)
  return Object.values(geometry).every((value) => typeof value === 'boolean' || Number.isFinite(value))
    && geometry.scaleX > 0 && geometry.scaleY > 0 && geometry.width >= 0 && geometry.height >= 0
    && Object.values(object.calcACoords()).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

/** 不读取 aCoords 缓存，计算当前对象的实时世界边界 */
export function liveBounds(object: FabricObject) {
  const stroke = !object.strokeUniform ? object.strokeWidth : 0
  const halfWidth = (object.width + stroke) / 2, halfHeight = (object.height + stroke) / 2
  const matrix = object.calcTransformMatrix()
  const points = [new Point(-halfWidth, -halfHeight), new Point(halfWidth, -halfHeight), new Point(halfWidth, halfHeight), new Point(-halfWidth, halfHeight)].map((point) => point.transform(matrix))
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y)
  const padding = object.strokeUniform ? object.strokeWidth / 2 : 0
  const left = Math.min(...xs) - padding, top = Math.min(...ys) - padding
  return { left, top, width: Math.max(...xs) - left + padding, height: Math.max(...ys) - top + padding }
}

/** 获取需要约束的叶对象，多选中允许出血的背景不限制其他子对象 */
export function boundedObjects(object: FabricObject, allowsOverflow: (object: FabricObject) => boolean): FabricObject[] {
  return object instanceof ActiveSelection
    ? object.getObjects().flatMap((child) => boundedObjects(child, allowsOverflow))
    : allowsOverflow(object) ? [] : [object]
}

/** 在固定锚点下限制候选变换；单轴候选保持非活动轴，组选不逐个重新定位 */
export function constrainCandidate(
  object: FabricObject,
  start: ObjectGeometry,
  width: number,
  height: number,
  allowsOverflow: (object: FabricObject) => boolean,
  anchor?: { point: Point; originX: Transform['originX']; originY: Transform['originY'] },
): void {
  const constrained = boundedObjects(object, allowsOverflow)
  if (!constrained.length) return
  const fits = () => constrained.every((child) => {
    const bounds = liveBounds(child)
    const epsilon = 1e-8
    return bounds.left >= -epsilon && bounds.top >= -epsilon
      && bounds.left + bounds.width <= width + epsilon && bounds.top + bounds.height <= height + epsilon
  })
  const candidate = captureGeometry(object)
  // Fabric 将旋转结果归一到 [0, 360)，0°→359° 是逆时针 1°，不能沿 359° 的长弧约束
  const angleDelta = ((candidate.angle - start.angle + 540) % 360 + 360) % 360 - 180
  const nonlinear = candidate.angle !== start.angle || candidate.skewX !== start.skewX || candidate.skewY !== start.skewY || candidate.width !== start.width
  if (!nonlinear && fits()) return
  const apply = (fraction: number) => {
    const next = { ...candidate }
    for (const key of ['left', 'top', 'scaleX', 'scaleY', 'angle', 'skewX', 'skewY', 'width', 'height'] as const) {
      next[key] = start[key] + (candidate[key] - start[key]) * fraction
    }
    next.angle = fraction === 1 ? candidate.angle : start.angle + angleDelta * fraction
    object.set(next)
    if (anchor) object.setPositionByOrigin(anchor.point, anchor.originX, anchor.originY)
  }
  apply(0)
  if (!fits()) {
    object.set(start)
    return
  }
  // 倾斜、旋转和文字换行的可行域不一定单调，先分段寻找出界区间，再精化该区间的有效端点
  let low = 0, high = 1
  const steps = nonlinear ? 64 : 1
  for (let i = 1; i <= steps; i++) {
    const fraction = i / steps
    apply(fraction)
    if (!fits()) { high = fraction; break }
    low = fraction
  }
  if (low === 1) { apply(1); return }
  for (let i = 0; i < 42; i++) {
    const middle = (low + high) / 2
    apply(middle)
    if (fits()) low = middle
    else high = middle
  }
  apply(low)
}

/**
 * 仅包装本次 Fabric 手势，从固定起点重算每个事件后限制候选，避免全局原型或控件改写
 *
 * Fabric 的事件发生在固定锚点定位之后；回调应在 Canvas 最早的变换监听器中完成约束
 */
export function installStableTransform(
  transform: Transform,
  constrain: (start: ObjectGeometry, anchor: { point: Point; originX: Transform['originX']; originY: Transform['originY'] } | undefined, action?: string) => void,
  changed: () => void,
): ((eventTransform: Transform) => void) | undefined {
  const handler = transform.actionHandler
  if (!handler) return
  const target = transform.target
  const start = captureGeometry(target)
  const initial = { ...transform, original: { ...transform.original } } as Transform & { signX?: number; signY?: number }
  if (transform.corner && target.controls[transform.corner]) {
    const point = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, transform.ex, transform.ey)
    initial.signX = transform.action === 'scaleY' ? 1 : Math.sign(point.x) || 1
    initial.signY = transform.action === 'scaleX' ? 1 : Math.sign(point.y) || 1
  }
  let eventHandled = false
  let previous = start
  const onEvent = (eventTransform: Transform) => {
    eventHandled = true
    if (!validGeometry(target)) { target.set(previous); return }
    const anchor = eventTransform.action === 'drag' ? undefined : {
      point: target.getPositionByOrigin(eventTransform.originX, eventTransform.originY),
      originX: eventTransform.originX, originY: eventTransform.originY,
    }
    constrain(start, anchor, eventTransform.action)
  }
  const wrapped: NonNullable<Transform['actionHandler']> = (event, current, x, y) => {
    previous = captureGeometry(target)
    const performed = current.actionPerformed
    const shiftKey = current.shiftKey, altKey = current.altKey
    target.set(start)
    for (const key of Object.keys(current)) if (!(key in initial)) Reflect.deleteProperty(current, key)
    Object.assign(current, initial, { original: { ...initial.original }, actionHandler: wrapped, actionPerformed: performed, shiftKey, altKey })
    eventHandled = false
    // 控件点击位置可能存在亚像素偏移；回到同一指针坐标必须精确恢复手势起点
    if (Math.abs(x - initial.ex) > 1e-8 || Math.abs(y - initial.ey) > 1e-8) handler(event, current, x, y)
    if (!validGeometry(target)) target.set(previous)
    else if (!eventHandled) onEvent(current)
    if (!validGeometry(target)) target.set(previous)
    target.setCoords()
    const next = captureGeometry(target)
    const didChange = Object.keys(previous).some((key) => previous[key as keyof ObjectGeometry] !== next[key as keyof ObjectGeometry])
    if (didChange) changed()
    return didChange
  }
  transform.actionHandler = wrapped
  return onEvent
}
