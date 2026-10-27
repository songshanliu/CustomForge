import { createCustomizer, type EditorViewState, type ProductCustomizerApi } from 'customforge'
import { createWorkbench } from 'customforge/workbench'
import { createPrintMappingFixture } from './printMappingFixture'

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Editor view: ${message}`)
}

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame)
}

let inputSequence = 0
async function browserInput(request: object): Promise<void> {
  const id = String(++inputSequence)
  document.body.dataset.viewportInput = JSON.stringify({ ...request, id })
  const deadline = performance.now() + 15_000
  while (document.body.dataset.viewportInputDone !== id) {
    if (performance.now() > deadline) throw new Error('Editor view: browser input driver did not respond')
    await new Promise(requestAnimationFrame)
  }
  delete document.body.dataset.viewportInput
  await settle()
}

async function pixels(source: string | Blob): Promise<Uint8ClampedArray> {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return context.getImageData(0, 0, canvas.width, canvas.height).data
}

function samePixels(a: ArrayLike<number>, b: ArrayLike<number>, label: string): void {
  assert(a.length === b.length && Array.from(a).every((value, i) => value === b[i]), `${label}: texture pixels changed with the view`)
}

function artwork(): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ed2525'
  context.fillRect(0, 0, 64, 64)
  context.fillStyle = '#2858ef'
  context.fillRect(32, 0, 32, 32)
  context.clearRect(0, 40, 24, 24)
  return canvas.toDataURL()
}

function point(state: EditorViewState, element: HTMLElement, x: number, y: number) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + state.offsetX + state.zoom * x, y: rect.top + state.offsetY + state.zoom * y }
}

/** 使用发布制品验证显示、真实输入、逻辑输出和生命周期，像素读取仅存在于测试消费者 */
export async function verifyEditorViewSmoke(): Promise<void> {
  document.body.dataset.smokePhase = 'editor-view-contract'
  const host = document.querySelector<HTMLElement>('#app')!
  const container = document.createElement('div')
  container.style.cssText = 'display:flex;gap:8px;align-items:start;flex-wrap:wrap'
  const editor = document.createElement('div')
  editor.style.cssText = `position:relative;width:${Math.min(innerWidth - 24, 800)}px;height:420px;display:grid;place-items:center`
  const viewer = document.createElement('div')
  viewer.style.cssText = 'width:240px;height:240px'
  container.append(editor, viewer)
  host.replaceChildren(container)
  const size = { width: 1024, height: 512 }
  const small = createPrintMappingFixture(true, false, size, true, false, false, { left: 0.68, top: 0.56, width: 0.1, height: 0.2 })
  const full = createPrintMappingFixture(true, false, size)
  const invalid = createPrintMappingFixture(true, false, size, true, false, false, { left: -2, top: 0, width: 0.2, height: 0.3 })
  const broken = createPrintMappingFixture(true, true, size)
  const evidence: { cases: object[] } = { cases: [] }
  let api: ProductCustomizerApi | undefined
  try {
    editor.style.display = 'none'
    api = await createCustomizer({ editor, viewer, readModelMetadata: true, product: { modelUrl: small.modelUrl, textureFlipY: false } })
    assert(!api.getEditorViewState().ready, 'hidden initialization claimed to be ready')
    editor.style.display = 'grid'
    await settle()
    const state = api.getEditorViewState()
    const bounds = state.printableBounds
    assert(state.ready && state.zoom > 1, 'small UV region was not enlarged')
    assert(Math.abs(state.offsetX + state.zoom * (bounds.left + bounds.width / 2) - state.viewport.width / 2) < 0.01, 'offset region is not centered')
    assert(state.offsetX < 0, 'negative translation was clamped')
    evidence.cases.push({ id: 'V01-V05', state })

    const text = api.addText({ text: 'TOP →', width: 420, fontSize: 44 })
    const image = await api.addImage({ src: artwork() })
    assert(Math.abs(image.transform.x - (bounds.left + bounds.width / 2)) < 0.01, 'default image is outside the visible area')
    assert(Math.abs(text.transform.x - (bounds.left + bounds.width / 2)) < 0.01, 'text preset width prevented default visible placement')
    const offscreen = await api.addImage({ src: artwork(), x: 24, y: 24, width: 16 })
    assert(offscreen.transform.x === 24 && offscreen.transform.y === 24, 'explicit API coordinates changed meaning')
    await settle()
    api.selectObject(image.id)
    api.clearHistory()
    await settle()
    const design = JSON.stringify(api.saveDesign())
    const baseline = await pixels(api.getTextureDataUrl())
    assert(baseline[(24 * 1024 + 24) * 4 + 3] > 200, 'off-viewport design object was culled from texture')
    samePixels(baseline, await pixels(await api.getTextureBlob()), 'Data URL/Blob')
    const internals = api as unknown as {
      textureBridge: { texture: { version: number; image: HTMLCanvasElement } }
      editor: { canvas: { getActiveObject(): { oCoords: Record<string, { x: number; y: number }> }; getObjects(): Array<{ render: (context: CanvasRenderingContext2D) => void }> } }
    }
    const live = internals.textureBridge.texture.image
    samePixels(baseline, live.getContext('2d')!.getImageData(0, 0, live.width, live.height).data, 'live texture')
    let contentEvents = 0
    const stop = api.on('change', () => { contentEvents++ })
    const version = internals.textureBridge.texture.version
    for (const width of [280, 500, 360, Math.min(innerWidth - 24, 800)]) {
      editor.style.width = `${width}px`
      await settle()
      api.fitEditorView()
      samePixels(baseline, await pixels(api.getTextureDataUrl()), `width-${width}`)
    }
    assert(contentEvents === 0 && internals.textureBridge.texture.version === version, 'view-only changes uploaded texture or emitted design change')
    assert(JSON.stringify(api.saveDesign()) === design && !api.canUndo(), 'view-only changes altered design or history')
    assert(api.getSelectedObjectIds().join() === image.id, 'resize lost the selection')
    stop()
    const beforeAdd = api.getObjects().length
    api.addText({ text: 'History probe' })
    editor.style.height = '380px'
    await settle()
    assert(await api.undo(), 'resize lost undo')
    assert(api.getObjects().length === beforeAdd, 'resize inserted an extra undo entry')
    assert(await api.redo(), 'resize lost redo')
    assert(api.getObjects().length === beforeAdd + 1, 'redo did not restore the exact design step')
    await api.undo()
    editor.style.display = 'none'
    api.fitEditorView()
    assert(!api.getEditorViewState().ready, 'hidden editor did not defer')
    editor.style.display = 'grid'
    await settle()
    assert(api.getEditorViewState().ready, 'shown editor did not refit automatically')
    await browserInput({ kind: 'capture', name: 'editor-view-print-area' })
    evidence.cases.push({ id: 'V08/V10-V12/V18/V20', decodedPixelsCompared: baseline.length, viewOnlyContentEvents: contentEvents, textureVersionStable: true })

    for (const dpr of [1, 1.5, 2]) {
      await browserInput({ kind: 'metrics', dpr, width: innerWidth, height: innerHeight })
      const current = api.getEditorViewState()
      const overlay = editor.querySelector<HTMLCanvasElement>('.customforge-uv-layout')!
      const upper = editor.querySelector<HTMLCanvasElement>('.upper-canvas')!
      assert(Math.abs(devicePixelRatio - dpr) < 0.01, 'DPR emulation did not apply')
      assert(Math.abs(upper.width - current.viewport.width * dpr) <= 1 && Math.abs(overlay.width - current.viewport.width * dpr) <= 1, `DPR backing stores disagree: dpr=${dpr}, upper=${upper.width}, overlay=${overlay.width}, viewport=${current.viewport.width}, media=${matchMedia(`(resolution: ${dpr}dppx)`).matches}`)
      samePixels(baseline, await pixels(api.getTextureDataUrl()), `DPR-${dpr}`)
      api.clearSelection()
      const center = point(current, upper, image.transform.x, image.transform.y)
      await browserInput({ kind: 'mouse', points: [center, center] })
      assert(api.getSelectedObjectIds().includes(image.id), `DPR ${dpr} pointer hit missed`)
      evidence.cases.push({ id: 'V06', dpr, state: current, overlay: [overlay.width, overlay.height] })
    }
    await browserInput({ kind: 'metrics', dpr: 1, width: innerWidth, height: innerHeight })
    const upper = editor.querySelector<HTMLCanvasElement>('.upper-canvas')!
    let current = api.getEditorViewState()
    let selected = api.getObjects().find((object) => object.id === image.id)!
    const start = point(current, upper, selected.transform.x, selected.transform.y)
    const end = { x: start.x + 25, y: start.y + 12 }
    await browserInput({ kind: 'mouse', points: [start, end] })
    selected = api.getObjects().find((object) => object.id === image.id)!
    assert(Math.abs(selected.transform.x - image.transform.x - 25 / current.zoom) < 1, 'mouse drag used an incorrect inverse transform')
    const rect = upper.getBoundingClientRect()
    const corner = internals.editor.canvas.getActiveObject().oCoords.br
    await browserInput({ kind: 'mouse', points: [{ x: rect.left + corner.x, y: rect.top + corner.y }, { x: rect.left + corner.x + 16, y: rect.top + corner.y + 16 }] })
    const scaled = api.getObjects().find((object) => object.id === image.id)!
    assert(scaled.transform.scaleX > selected.transform.scaleX, 'visible scaling control missed')
    const rotation = internals.editor.canvas.getActiveObject().oCoords.mtr
    await browserInput({ kind: 'mouse', points: [{ x: rect.left + rotation.x, y: rect.top + rotation.y }, { x: rect.left + rotation.x + 35, y: rect.top + rotation.y + 15 }] })
    assert(Math.abs(api.getObjects().find((object) => object.id === image.id)!.transform.rotation) > 5, 'visible rotation control missed')
    api.updateObjectTransform(image.id, { x: bounds.left + bounds.width * 0.8, y: bounds.top + bounds.height * 0.65 })
    api.clearSelection()
    current = api.getEditorViewState()
    const textCenter = point(current, upper, text.transform.x - text.width * text.transform.scaleX * 0.3, text.transform.y)
    await browserInput({ kind: 'mouse', points: [textCenter, textCenter] })
    const imageObject = api.getObjects().find((object) => object.id === image.id)!
    const imageCenter = point(current, upper, imageObject.transform.x, imageObject.transform.y)
    await browserInput({ kind: 'mouse', modifiers: 8, points: [imageCenter, imageCenter] })
    assert(api.getSelectedObjectIds().length === 2, 'mouse Shift selection did not select both objects')
    api.selectObjects([image.id, text.id])
    const multiPixels = await pixels(api.getTextureDataUrl())
    api.clearSelection()
    samePixels(multiPixels, await pixels(api.getTextureDataUrl()), 'active selection')
    api.selectObject(image.id)
    selected = api.getObjects().find((object) => object.id === image.id)!
    current = api.getEditorViewState()
    const touch = point(current, upper, selected.transform.x, selected.transform.y)
    await browserInput({ kind: 'touch', points: [touch, { x: touch.x - 12, y: touch.y + 8 }] })
    const touched = api.getObjects().find((object) => object.id === image.id)!
    assert(Math.abs(touched.transform.x - selected.transform.x + 12 / current.zoom) < 1, 'touch drag missed or applied inverse twice')
    evidence.cases.push({ id: 'V07', mouseDrag: true, scale: true, rotate: true, shiftMultiSelect: true, multiSelectPixelsStable: true, touch: true })

    api.editText(text.id)
    const focused = document.activeElement
    const editingPixels = await pixels(api.getTextureDataUrl())
    assert(document.activeElement === focused && focused?.tagName === 'TEXTAREA', 'texture export disturbed inline editing focus')
    api.clearSelection()
    samePixels(editingPixels, await pixels(api.getTextureDataUrl()), 'inline text editing')
    const beforeFailure = api.getEditorViewState()
    const object = internals.editor.canvas.getObjects()[0]
    const render = object.render
    api.updateText(text.id, { color: '#345678' })
    object.render = () => { throw new Error('injected texture render failure') }
    let failed = false
    try { api.getTextureDataUrl() } catch { failed = true } finally { object.render = render }
    assert(failed, 'exception test did not enter render failure')
    assert(JSON.stringify(beforeFailure) === JSON.stringify(api.getEditorViewState()), 'failed export corrupted the viewport')
    assert((await api.getTextureBlob()).size > 0, 'export did not recover after injected failure')
    evidence.cases.push({ id: 'render-isolation', inlineEditingFocusPreserved: true, exceptionRecovery: true })

    await api.loadDesign(JSON.parse(design))
    await settle()
    samePixels(baseline, await pixels(api.getTextureDataUrl()), 'Schema 1 restore')
    const stable = api.getEditorViewState()
    await api.loadProduct({ modelUrl: broken.modelUrl }).then(() => { throw new Error('invalid model unexpectedly loaded') }, () => undefined)
    assert(JSON.stringify(api.getEditorViewState()) === JSON.stringify(stable), 'failed model switch changed viewport')
    const switches = await Promise.allSettled([api.loadProduct({ modelUrl: full.modelUrl }), api.loadProduct({ modelUrl: small.modelUrl })])
    assert(switches[0].status === 'rejected' && switches[1].status === 'fulfilled', 'rapid switch did not retain newest product')
    assert(Math.abs(api.getEditorViewState().printableBounds.width - bounds.width) < 0.01, 'rapid switch retained stale bounds')
    await api.loadProduct({ modelUrl: invalid.modelUrl })
    assert(api.getEditorViewState().fallback === 'invalid-print-area' && !api.getEditorViewState().ready, 'outside original UV falsely reported a real area')
    evidence.cases.push({ id: 'V13/V16/V17', originalFallback: api.getEditorViewState(), newestSwitchOnly: true })
    api.destroy()
    api = undefined

    const workbench = await createWorkbench({ container: host, editorView: { fit: 'canvas', paddingRatio: 0, minPadding: 28, allowUpscale: false }, product: { modelUrl: small.modelUrl }, editorWidth: 1024, editorHeight: 512 })
    try {
      assert(workbench.customizer.getEditorViewState().fit === 'canvas' && workbench.customizer.getEditorViewState().zoom <= 1, 'Workbench did not forward compatibility options')
      const doc = workbench.customizer.saveDesign()
      workbench.setLayout('layers', true)
      await settle()
      assert(JSON.stringify(workbench.customizer.saveDesign()) === JSON.stringify(doc), 'layer panel changed the design')
      evidence.cases.push({ id: 'Workbench', optionsForwarded: true, layersPreserveDesign: true })
      await browserInput({ kind: 'capture', name: 'editor-view-canvas-compatibility' })
    } finally { workbench.destroy() }
  } finally {
    api?.destroy()
    small.dispose(); full.dispose(); invalid.dispose(); broken.dispose()
    const node = document.createElement('script')
    node.id = 'customforge-editor-view-evidence'
    node.type = 'application/json'
    node.textContent = JSON.stringify(evidence)
    document.body.append(node)
  }
}
