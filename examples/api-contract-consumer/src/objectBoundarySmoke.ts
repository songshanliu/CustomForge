import { createCustomizer, type DesignDocument, type DesignObjectTransform, type ObjectBoundaryOptions, type ProductCustomizerApi } from 'customforge'
import { createWorkbench } from 'customforge/workbench'
import { createPrintMappingFixture } from './printMappingFixture'

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Object boundary: ${message}`)
}

function near(a: number, b: number, label: string): void {
  assert(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)), `${label}: ${a} != ${b}`)
}

function sameTransform(a: DesignObjectTransform, b: DesignObjectTransform, label: string): void {
  for (const key of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY'] as const) near(a[key] ?? 0, b[key] ?? 0, `${label}/${key}`)
  assert(a.flipX === b.flipX && a.flipY === b.flipY, `${label}/flip`)
}

const settle = async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame) }
let sequence = 10_000
async function input(request: object): Promise<void> {
  const id = String(++sequence)
  document.body.dataset.viewportInput = JSON.stringify({ ...request, id })
  const deadline = performance.now() + 30_000
  while (document.body.dataset.viewportInputDone !== id) {
    if (performance.now() > deadline) throw new Error('Object boundary: input timeout')
    await new Promise(requestAnimationFrame)
  }
  delete document.body.dataset.viewportInput
  await settle()
}

function artwork(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 80; canvas.height = 60
  const context = canvas.getContext('2d')!
  context.fillStyle = '#416ae5'; context.fillRect(0, 0, 80, 60)
  context.fillStyle = '#e98b22'
  for (let x = 0; x < 80; x += 20) for (let y = 0; y < 60; y += 20) context.fillRect(x, y, 10, 10)
  context.clearRect(0, 0, 6, 6)
  return canvas.toDataURL()
}

async function decoded(source: string | Blob) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0); bitmap.close()
  return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }
}

/** 使用独立 npm 制品验证真实连续控件拖拽、对象边界、历史与固定尺寸纹理 */
export async function verifyObjectBoundarySmoke(): Promise<void> {
  document.body.dataset.smokePhase = 'object-boundary-contract'
  const host = document.querySelector<HTMLElement>('#app')!
  const editor = document.createElement('div'), viewer = document.createElement('div')
  editor.style.cssText = `position:relative;width:${Math.min(innerWidth - 24, 850)}px;height:440px`
  viewer.style.cssText = 'width:240px;height:200px'
  host.replaceChildren(editor, viewer)
  const evidence: { cases: object[] } = { cases: [] }
  const fixtures = [
    createPrintMappingFixture(true, false, { width: 1380, height: 800 }, true, false, false, { left: 3.5829609632492065 / 1380, top: 2.71453857421875 / 800, width: 1374.3838745355606 / 1380, height: 794.6906089782715 / 800 }),
    createPrintMappingFixture(true, false, { width: 1550, height: 1190 }),
    createPrintMappingFixture(true, false, { width: 1024, height: 512 }, false),
  ]
  const query = new URLSearchParams(location.search)
  const models = query.has('boundary-only') ? [] : fixtures.map((fixture, index) => ({ modelUrl: fixture.modelUrl, readModelMetadata: index !== 2, name: ['snowman-size', '40oz-size', 'default-size'][index]! }))
  if (query.has('boundary-model')) models.push({ modelUrl: '/__customforge_smoke/boundary.glb', readModelMetadata: true, name: 'real-model' })
  let api: ProductCustomizerApi | undefined
  const mobile = query.get('smoke') === 'mobile'
  try {
    if (mobile) await input({ kind: 'metrics', dpr: 2, width: innerWidth, height: innerHeight })
    for (const model of models) for (const background of ['contain', 'overflow'] as const) {
      document.body.dataset.smokePhase = `object-boundary/${model.name}/${background}`
      const objectBoundary: ObjectBoundaryOptions = { background }
      api = await createCustomizer({ editor, viewer, objectBoundary, readModelMetadata: model.readModelMetadata, product: { modelUrl: model.modelUrl, textureFlipY: false } })
      await settle()
      const size = api.getCanvasSize()
      const dense = !mobile && (model.name === 'snowman-size' || (model.name === 'real-model' && size.width === 1380))
      const angles = dense ? [0, 30, 90] : [30, 90]
      const flips = dense ? [false, true] : [true]
      const image = await api.addImage({ src: artwork(), role: 'background' })
      const id = image.id
      const internals = api as any
      const canvas = internals.editor.canvas
      const transform = () => api!.getObjects().find((object) => object.id === id)!.transform
      const fabricObject = () => canvas.getObjects().find((object: any) => internals.editor.objectIds.get(object) === id)
      // 满打印区域的初始背景也必须在连续拖拽后保持非活动轴
      const locked = JSON.stringify(api.saveDesign())
      api.selectObject(id)
      let object = fabricObject()
      const rect = () => canvas.upperCanvasEl.getBoundingClientRect()
      const controlPoint = (name: string) => {
        object = canvas.getActiveObject()
        object.setCoords()
        const point = object.oCoords[name], bounds = rect()
        return { x: bounds.left + point.x, y: bounds.top + point.y }
      }
      const drag = async (name: string, dx: number, dy: number, moves = 15, repeat = 0, back = false, modifiers = 0) => {
        const from = controlPoint(name), to = { x: Math.max(1, Math.min(innerWidth - 2, from.x + dx)), y: Math.max(1, Math.min(innerHeight - 2, from.y + dy)) }
        let lastMove: DesignObjectTransform | undefined
        const stop = canvas.on('mouse:move', () => { lastMove = { ...transform() } })
        await input({ kind: 'mouse', points: [from, to], moves, repeat, back, modifiers })
        stop()
        const result = { ...transform() }
        if (lastMove) sameTransform(result, lastMove, 'mouseup must not apply another scale')
        return result
      }
      await drag('mr', 25, 0)
      assert(JSON.stringify(api.saveDesign()) === locked, 'locked background changed through controls')
      api.setObjectLocked(id, false)
      const initialFull = { ...transform() }
      await drag('mr', 300, 0, 15)
      near(transform().scaleY, initialFull.scaleY, 'full background non-active Y')
      await api.loadDesign(JSON.parse(locked))
      api.setObjectLocked(id, false)
      api.updateObjectTransform(id, { scaleX: image.transform.scaleX * 0.72, scaleY: image.transform.scaleY * 0.8 })
      const base = api.saveDesign()
      const start = { ...transform() }
      assert(Math.abs(start.scaleX - start.scaleY) > 1e-3, 'fixture should start with non-uniform scale')
      const reset = async (document: DesignDocument = base) => { await api!.loadDesign(document); api!.selectObject(id); await settle(); api!.clearHistory() }
      for (const [name, dx, dy, inactive] of [['mr', 300, 0, 'scaleY'], ['ml', -300, 0, 'scaleY'], ['mt', 0, -180, 'scaleX'], ['mb', 0, 180, 'scaleX']] as const) {
        let reference: DesignObjectTransform | undefined
        const densities = dense ? [1, 15, 60] : [15]
        for (const moves of densities) {
          await reset()
          const anchorName = { mr: 'ml', ml: 'mr', mt: 'mb', mb: 'mt' }[name]
          const anchor = controlPoint(anchorName)
          const result = await drag(name, dx, dy, moves)
          assert(result[inactive === 'scaleX' ? 'scaleY' : 'scaleX'] > start[inactive === 'scaleX' ? 'scaleY' : 'scaleX'], `${name}/${moves} did not scale the active axis`)
          near(result[inactive], start[inactive], `${name}/${moves}/inactive`)
          const afterAnchor = controlPoint(anchorName)
          near(afterAnchor.x, anchor.x, `${name}/anchorX`); near(afterAnchor.y, anchor.y, `${name}/anchorY`)
          if (reference) sameTransform(result, reference, `${name}/density-${moves}`)
          else reference = result
          const bounds = internals.editor.getCanvasSize()
          if (background === 'contain') {
            const box = fabricObject().getBoundingRect()
            assert(box.left >= -1e-5 && box.top >= -1e-5 && box.left + box.width <= bounds.width + 1e-5 && box.top + box.height <= bounds.height + 1e-5, `${name} did not contain`)
          }
        }
        if (dense && (name === 'mr' || name === 'mt')) { await reset(); sameTransform(await drag(name, dx, dy, 15, 100), reference!, `${name}/repeated endpoint`) }
        await reset(); sameTransform(await drag(name, dx, dy, 15, 0, true), start, `${name}/return-to-start`)
        await reset(); const final = await drag(name, dx, dy)
        assert(await api.undo(), 'drag had no undo step'); sameTransform(transform(), start, 'undo')
        assert(!api.canUndo(), 'one drag created multiple history steps')
        assert(await api.redo(), 'drag had no redo step'); sameTransform(transform(), final, 'redo')
        evidence.cases.push({ model: model.name, size, background, control: name, start, final, eventDensities: densities, repeatedEndpoint: dense && (name === 'mr' || name === 'mt') ? 100 : 0, returnToStart: true, history: true })
      }
      for (const rotation of angles) for (const flipX of flips) {
        const small = structuredClone(base)
        Object.assign(small.objects[0]!.transform, { scaleX: image.transform.scaleX * 0.28, scaleY: image.transform.scaleY * 0.22, rotation, flipX })
        for (const corner of ['br', 'bl', 'tr', 'tl']) {
          await reset(small)
          const before = { ...transform() }
          const result = await drag(corner, corner.endsWith('r') ? 250 : -250, corner.startsWith('b') ? 150 : -150, 5)
          near(result.scaleX / result.scaleY, before.scaleX / before.scaleY, 'corner ratio')
        }
      }
      evidence.cases.push({ model: model.name, background, corners: ['br', 'bl', 'tr', 'tl'], initialAngles: angles, initialFlips: flips, nonUniformRatioPreserved: true, dpr: devicePixelRatio, zoom: api.getEditorViewState().zoom })
      // 实际旋转控制点跨过 360°/0°，并验证不同事件密度的结果
      const rotateDocument = structuredClone(base)
      Object.assign(rotateDocument.objects[0]!.transform, { scaleX: image.transform.scaleX * 0.25, scaleY: image.transform.scaleY * 0.22, rotation: 350 })
      let rotationReference: DesignObjectTransform | undefined
      for (const moves of [1, 60]) {
        await reset(rotateDocument)
        const from = controlPoint('mtr'), state = api.getEditorViewState(), bounds = rect()
        const center = { x: bounds.left + state.offsetX + transform().x * state.zoom, y: bounds.top + state.offsetY + transform().y * state.zoom }
        const vector = { x: from.x - center.x, y: from.y - center.y }, radians = Math.PI / 9
        const to = { x: center.x + vector.x * Math.cos(radians) - vector.y * Math.sin(radians), y: center.y + vector.x * Math.sin(radians) + vector.y * Math.cos(radians) }
        await input({ kind: 'mouse', points: [from, to], moves })
        const result = { ...transform() }
        assert(result.rotation >= 0 && result.rotation < 30, `rotation crossing zero took the wrong arc: ${result.rotation}`)
        if (rotationReference) sameTransform(result, rotationReference, 'rotation density')
        else rotationReference = result
      }
      await reset(rotateDocument)
      const skewModifier = canvas.altActionKey === 'altKey' ? 1 : canvas.altActionKey === 'ctrlKey' ? 2 : 8
      await drag('mr', 0, 28, 15, 0, false, skewModifier)
      const skewed = api.saveDesign()
      assert(Math.abs(skewed.objects[0]!.transform.skewY ?? 0) > 0.01, 'native skew control did not run')
      const skewPixels = await decoded(api.getTextureDataUrl())
      await api.loadDesign(skewed)
      sameTransform(transform(), skewed.objects[0]!.transform, 'skew restoration')
      const skewRestored = await decoded(api.getTextureDataUrl())
      assert(skewPixels.pixels.every((value, index) => value === skewRestored.pixels[index]), 'skew restore pixels changed')
      evidence.cases.push({ model: model.name, background, rotationAcrossZero: rotationReference, skew: skewed.objects[0]!.transform })
      await reset()
      for (const options of [{ scaleX: start.scaleX * 8 }, { scaleY: start.scaleY * 8 }, { scaleX: start.scaleX * 3, scaleY: start.scaleY * 2 }, { x: -200, y: 100, scaleX: start.scaleX * 1.1, rotation: 30 }]) {
        await reset()
        const first = api.updateObjectTransform(id, options)!.transform
        for (let i = 0; i < 10; i++) sameTransform(api.updateObjectTransform(id, options)!.transform, first, 'absolute API idempotency')
        if (!('scaleY' in options)) near(first.scaleY, start.scaleY, 'API inactive Y')
        if (!('scaleX' in options)) near(first.scaleX, start.scaleX, 'API inactive X')
      }
      const stable = JSON.stringify(api.saveDesign())
      try { api.updateObjectTransform(id, { scaleX: Number.MAX_VALUE }); throw new Error('accepted overflowing geometry') } catch (error) { assert(error instanceof RangeError, 'unexpected overflow rejection') }
      assert(JSON.stringify(api.saveDesign()) === stable, 'failed API call mutated design')
      const overflowingDocument = api.saveDesign()
      overflowingDocument.objects[0]!.transform.scaleX = Number.MAX_VALUE
      await api.loadDesign(overflowingDocument).then(() => { throw new Error('accepted overflowing saved geometry') }, (error) => { assert(error instanceof RangeError, 'unexpected saved geometry rejection') })
      assert(JSON.stringify(api.saveDesign()) === stable, 'failed load replaced the existing design')
      await reset()
      const shifted = api.updateObjectTransform(id, { scaleX: start.scaleX * 2, x: -20, y: 80 })!
      if (background === 'overflow') { near(shifted.transform.x, -20, 'overflow center'); near(shifted.transform.scaleY, start.scaleY, 'overflow Y') }
      const saved = api.saveDesign()
      const output = await decoded(api.getTextureDataUrl())
      assert(output.width === size.width && output.height === size.height, 'overflow changed output dimensions')
      for (const version of [1, 2] as const) {
        const document = { ...saved, version, ...(version === 2 ? { printMapping: api.getPrintSurfaceInfo().mapping } : {}) } as DesignDocument
        await api.loadDesign(document)
        sameTransform(transform(), shifted.transform, `Schema ${version} restore`)
        const restored = await decoded(await api.getTextureBlob())
        assert(restored.pixels.length === output.pixels.length && restored.pixels.every((value, index) => value === output.pixels[index]), `Schema ${version} pixels changed`)
      }
      // 出血背景与普通图片组选只约束普通成员，保存必须使用世界矩阵
      if (background === 'overflow') {
        api.updateObjectTransform(id, { x: size.width / 2, y: size.height / 2, scaleX: image.transform.scaleX * 1.05, scaleY: image.transform.scaleY * 0.8 })
        const element = await api.addImage({ src: artwork(), width: size.width * 0.13, x: size.width * 0.55, y: size.height * 0.5 })
        api.selectObjects([id, element.id])
        const group = canvas.getActiveObject()
        group.setCoords()
        const groupPoint = group.oCoords.br, bounds = rect()
        const elementStart = api.getObjects().find((entry) => entry.id === element.id)!.transform
        await input({ kind: 'mouse', points: [{ x: bounds.left + groupPoint.x, y: bounds.top + groupPoint.y }, { x: Math.min(innerWidth - 2, bounds.left + groupPoint.x + 20), y: bounds.top + groupPoint.y + 12 }], moves: 15 })
        const grouped = api.saveDesign()
        assert(grouped.objects.find((entry) => entry.id === element.id)!.transform.scaleX > elementStart.scaleX, 'mixed selection control did not transform its members')
        api.clearSelection()
        const ungrouped = api.saveDesign()
        grouped.objects.forEach((entry, index) => sameTransform(entry.transform, ungrouped.objects[index]!.transform, 'group world transform'))
        const beforePixels = await decoded(api.getTextureDataUrl())
        await api.loadDesign(grouped)
        const afterPixels = await decoded(api.getTextureDataUrl())
        // 等价矩阵的分解只允许边缘抗锯齿误差，主体像素应一致
        const changed = beforePixels.pixels.reduce((count, value, index) => count + (Math.abs(value - afterPixels.pixels[index]!) > 3 ? 1 : 0), 0)
        assert(changed < beforePixels.pixels.length * 0.01, 'group restore changed image geometry')
        evidence.cases.push({ model: model.name, background, mixedSelection: true, changedPixelComponents: changed })
      }
      await reset()
      // 在缩小显示的 1550×1190 画布中保留足够的屏幕高度，避免 mr 与两个角点命中区重叠
      const text = api.addText({ text: 'Boundary', width: 150, fontSize: 64, x: size.width / 2, y: size.height / 2 })
      api.updateObjectTransform(text.id, { x: -500, y: -500 })
      const textObject = canvas.getObjects().find((entry: any) => internals.editor.objectIds.get(entry) === text.id)
      assert(textObject.getBoundingRect().left >= -1e-5 && textObject.getBoundingRect().top >= -1e-5, 'ordinary text escaped its boundary')
      api.updateObjectTransform(text.id, { x: size.width / 2, y: size.height / 2 })
      api.selectObject(text.id)
      const textScale = { ...api.getObjects().find((entry) => entry.id === text.id)!.transform }
      const textFrom = controlPoint('mr')
      let textAction = ''
      const stopTextAction = canvas.on('before:transform', ({ transform }: any) => { textAction = transform.action })
      await input({ kind: 'mouse', points: [textFrom, { x: textFrom.x + 100, y: textFrom.y }], moves: 15 })
      stopTextAction()
      assert(textAction === 'resizing', `textbox mr hit a different control: ${textAction}`)
      evidence.cases.push({ model: model.name, background, textResize: textAction, overflowGeometryRejected: true, apiIdempotent: true, schema1And2PixelsEqual: true })
      near(api.getObjects().find((entry) => entry.id === text.id)!.transform.scaleY, textScale.scaleY, 'textbox resize must not change vertical scale')
      if (background === 'overflow') {
        api.updateObjectTransform(id, { x: -200, scaleX: start.scaleX * 3 })
        api.selectObjects([id, text.id])
        const beforeColor = { ...transform() }
        api.updateText(text.id, { color: '#184acb' })
        sameTransform(transform(), beforeColor, 'mixed text formatting changed overflow background')
        assert(api.getSelectedObjectIds().length === 2, 'mixed text formatting lost selection')
      }
      api.removeObject(text.id)
      api.clearSelection()
      const restoreDoc = api.saveDesign()
      await input({ kind: 'capture', name: `object-boundary-${model.name}-${background}-${mobile ? 'mobile' : 'desktop'}` })
      const transparent = await decoded(api.getTextureDataUrl())
      assert(transparent.pixels.some((value, index) => index % 4 === 3 && value === 0), 'transparent pixels lost')
      api.destroy(); api = undefined
      api = await createCustomizer({ editor, viewer, objectBoundary, initialDesign: restoreDoc, product: { modelUrl: model.modelUrl, textureFlipY: false }, readModelMetadata: model.readModelMetadata })
      sameTransform(api.getObjects()[0]!.transform, restoreDoc.objects[0]!.transform, 'initialDesign')
      api.destroy(); api = undefined
    }
    const workbench = await createWorkbench({ container: host, objectBoundary: { background: 'overflow' }, product: { modelUrl: fixtures[2]!.modelUrl } })
    try {
      const image = await workbench.customizer.addImage({ src: artwork(), role: 'background' })
      const result = workbench.customizer.updateObjectTransform(image.id, { x: -100, scaleX: image.transform.scaleX * 2 })!
      near(result.transform.x, -100, 'Workbench boundary forwarding')
      const element = await workbench.customizer.addImage({ src: artwork() })
      const skewed = workbench.customizer.saveDesign()
      skewed.objects.find((object) => object.id === element.id)!.transform.skewX = 25
      await workbench.customizer.loadDesign(skewed)
      assert(workbench.customizer.setImageAsBackground(element.id), 'skewed image could not become a background')
      const converted = workbench.customizer.getObjects()[0]!
      assert(converted.id === element.id && converted.locked && converted.type === 'image' && converted.role === 'background', 'background replacement/lock contract changed')
      near(converted.transform.skewX ?? 0, 0, 'background conversion skewX')
      near(converted.transform.skewY ?? 0, 0, 'background conversion skewY')
      evidence.cases.push({ workbenchForwarding: true })
    } finally { workbench.destroy() }
  } finally {
    api?.destroy(); fixtures.forEach((fixture) => fixture.dispose())
    const node = document.createElement('script')
    node.type = 'application/json'; node.id = 'customforge-object-boundary-evidence'; node.textContent = JSON.stringify(evidence)
    document.body.append(node)
  }
}
