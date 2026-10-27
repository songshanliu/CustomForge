import type { CanvasBounds, DesignCanvas, EditorViewOptions, EditorViewState } from '../core/types'

const MAX_EDITOR_ZOOM = 128

/** 校验并补全视图配置，不修改设计分辨率或 UV 映射 */
export function normalizeEditorViewOptions(options: EditorViewOptions = {}): Required<EditorViewOptions> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('editorView must be an options object')
  const fit = options.fit === undefined ? 'print-area' : options.fit
  const paddingRatio = options.paddingRatio === undefined ? 0.06 : options.paddingRatio
  const minPadding = options.minPadding === undefined ? 16 : options.minPadding
  const allowUpscale = options.allowUpscale === undefined ? true : options.allowUpscale
  if (fit !== 'print-area' && fit !== 'canvas') throw new TypeError('editorView.fit must be print-area or canvas')
  if (!Number.isFinite(paddingRatio) || paddingRatio < 0 || paddingRatio > 0.5) throw new RangeError('editorView.paddingRatio must be between 0 and 0.5')
  if (!Number.isFinite(minPadding) || minPadding < 0) throw new RangeError('editorView.minPadding must be finite and non-negative')
  if (typeof allowUpscale !== 'boolean') throw new TypeError('editorView.allowUpscale must be a boolean')
  return { fit, paddingRatio, minPadding, allowUpscale }
}

/** 判断边界是否具有有限、非退化的二维范围 */
export function hasEditorViewBounds(bounds: CanvasBounds): boolean {
  return [bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) && bounds.width > 0 && bounds.height > 0
}

/**
 * 在 CSS 像素中计算统一取景变换；隐藏容器保留上次有效变换
 *
 * @param designCanvas 不随容器变化的逻辑纹理尺寸
 * @param printableBounds 映射后与逻辑画布相交的真实打印范围，空范围不得伪装为整画布
 * @param viewport 容器内容尺寸，不乘 DPR
 * @param options 已校验的显示配置
 * @param previous 上次状态，仅用于暂不可见容器
 * @returns 独立状态；异常区域明确回退整画布，极小区域最多放大 128 倍
 */
export function calculateEditorView(
  designCanvas: DesignCanvas,
  printableBounds: CanvasBounds,
  viewport: DesignCanvas,
  options: Required<EditorViewOptions>,
  previous?: EditorViewState,
): EditorViewState {
  const fallback = options.fit === 'print-area' && !hasEditorViewBounds(printableBounds) ? 'invalid-print-area' : 'none'
  const bounds = options.fit === 'canvas' || fallback !== 'none'
    ? { left: 0, top: 0, ...designCanvas } : printableBounds
  const availableWidth = viewport.width - 2 * options.minPadding
  const availableHeight = viewport.height - 2 * options.minPadding
  const usable = [viewport.width, viewport.height, availableWidth, availableHeight].every(Number.isFinite) && availableWidth > 0 && availableHeight > 0
  let zoom = previous?.zoom ?? 1
  let offsetX = previous?.offsetX ?? 0
  let offsetY = previous?.offsetY ?? 0
  let zoomLimited = previous?.zoomLimited ?? false
  if (usable) {
    const requested = Math.min(
      availableWidth / (bounds.width * (1 + 2 * options.paddingRatio)),
      availableHeight / (bounds.height * (1 + 2 * options.paddingRatio)),
      options.allowUpscale ? Infinity : 1,
    )
    zoom = Math.min(requested, MAX_EDITOR_ZOOM)
    zoomLimited = requested > MAX_EDITOR_ZOOM
    offsetX = viewport.width / 2 - zoom * (bounds.left + bounds.width / 2)
    offsetY = viewport.height / 2 - zoom * (bounds.top + bounds.height / 2)
  }
  return {
    ...options, designCanvas: { ...designCanvas }, printableBounds: { ...printableBounds }, viewport: { ...viewport },
    zoom, offsetX, offsetY, zoomLimited, fallback,
    ready: usable && fallback === 'none',
  }
}
