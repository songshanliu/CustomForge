import { createCustomizer, PrintSurfaceError, type DesignDocument, type ProductCustomizerApi, type PrintDiagnostic } from 'customforge'
import { createWorkbench, type CustomForgeWorkbenchApi } from 'customforge/workbench'
import { createPrintMappingFixture } from './printMappingFixture'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Print mapping: ${message}`)
}

function artwork(transparent = true): string {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')!
  for (const [index, color] of ['#ed2525', '#20c756', '#2858ef', '#edd02a'].entries()) {
    context.fillStyle = color
    context.fillRect(index * 64, 0, 64, 128)
  }
  context.strokeStyle = 'rgba(0, 0, 0, 0.12)'
  context.lineWidth = 1
  context.beginPath()
  for (let x = 32; x < 256; x += 32) { context.moveTo(x, 0); context.lineTo(x, 128) }
  for (let y = 32; y < 128; y += 32) { context.moveTo(0, y); context.lineTo(256, y) }
  context.stroke()
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 256, 12)
  context.fillStyle = '#111111'
  context.fillRect(0, 116, 256, 12)
  context.font = '10px Arial'
  context.fillText('TOP →', 4, 10)
  if (transparent) context.clearRect(192, 70, 64, 30)
  return canvas.toDataURL('image/png')
}

function framePng(frame: Awaited<ReturnType<typeof capture>>): string {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')!
  const image = context.createImageData(frame.width, frame.height)
  for (let row = 0; row < frame.height; row += 1) {
    const start = (frame.height - row - 1) * frame.width * 4
    image.data.set(frame.pixels.subarray(start, start + frame.width * 4), row * frame.width * 4)
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 用调用方提供的本地雪人杯原始资产验证完整 UV 适配，不将模型写入仓库或 npm 制品
 *
 * @param modelUrl 测试服务提供的同源 GLB 地址，模型应包含 PrintArea 节点
 * @param modelRevision 测试脚本计算的资产 SHA-256，用于保存恢复时确认同一文件
 * @param baselineEntry 可选的旧发布包 Workbench 入口，仅用于关闭 HTTP 缓存后的交错性能对照
 * @returns 验证通过后将像素计数和 PNG 证据写入测试专用 JSON 节点
 */
export async function verifyRealPrintMappingSmoke(modelUrl: string, modelRevision: string, baselineEntry?: string): Promise<void> {
  const host = document.querySelector<HTMLElement>('#app')!
  const evidence: { cases: object[]; images: Record<string, string>; benchmark?: object } = { cases: [], images: { artwork: artwork() } }
  let workbench: CustomForgeWorkbenchApi | undefined
  const captureViews = async (active: CustomForgeWorkbenchApi, views: ReturnType<CustomForgeWorkbenchApi['customizer']['getViewState']>[]) => {
    const frames = []
    for (const view of views) {
      active.customizer.setViewState(view)
      const canvas = active.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!
      frames.push(await capture(canvas))
    }
    return frames
  }
  try {
    if (baselineEntry) {
      document.body.dataset.smokePhase = 'real-print-mapping:published-baseline-comparison'
      const baseline = await import(/* @vite-ignore */ baselineEntry) as { createWorkbench: typeof createWorkbench }
      const samples: { implementation: string; initializationMs: number; renderedReadbackMs: number }[] = []
      for (const implementation of ['baseline', 'updated', 'baseline', 'updated', 'updated', 'baseline', 'baseline', 'updated']) {
        const factory = implementation === 'baseline' ? baseline.createWorkbench : createWorkbench
        const started = performance.now()
        workbench = await factory({ container: host, editorWidth: 1024, editorHeight: 512, product: { modelUrl, surfaceMesh: 'PrintArea', textureFlipY: false, uvMapping: { mode: 'fit-bounds' } } })
        const initialized = performance.now()
        const frame = await capture(workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!)
        assert(frame.pixels.some((value, index) => index % 4 === 3 && value > 200), 'performance sample did not render its model')
        if (samples.length > 0 || implementation === 'updated') samples.push({ implementation, initializationMs: initialized - started, renderedReadbackMs: performance.now() - started })
        workbench.destroy()
        workbench = undefined
      }
      // 首轮只预热两份模块和字体；后六轮交错测量相同模型，HTTP 缓存由测试服务关闭
      evidence.benchmark = { cache: 'HTTP no-store', canvas: { width: 1024, height: 512 }, samples: samples.slice(1) }
    }
    for (const mode of ['original', 'fit-bounds'] as const) {
      for (const textureFlipY of mode === 'original' ? [false] : [false, true]) {
        const label = `${mode}-flip-${textureFlipY}`
        document.body.dataset.smokePhase = `real-print-mapping:${label}`
        workbench = await createWorkbench({
          container: host,
          editorWidth: 1024, editorHeight: 512,
          product: { modelUrl, modelRevision, surfaceMesh: 'PrintArea', uvMapping: { mode }, textureFlipY },
        })
        const customizer = workbench.customizer
        const info = customizer.getPrintSurfaceInfo()
        assert(info.rawBounds.maxU < 0 && info.triangleCount === 1536, 'real asset does not match the inspected snowman PrintArea')
        assert(info.canvas.width === 1024 && info.canvas.height === 512 && info.sources.canvas === 'configuration', 'real model guessed the reference canvas size')
        assert(mode === 'fit-bounds' || info.diagnostics.some(({ code }) => code === 'UV_OUTSIDE_DESIGN_DOMAIN'), 'original mode hid the negative-UV diagnostic')
        const initial = customizer.getViewState()
        const dx = initial.position.x - initial.target.x, dz = initial.position.z - initial.target.z
        const views = [0, 1, 2, 3].map((quarter) => {
          const angle = quarter * Math.PI / 2
          return { target: { ...initial.target }, position: {
            x: initial.target.x + dx * Math.cos(angle) + dz * Math.sin(angle),
            y: initial.position.y,
            z: initial.target.z + dz * Math.cos(angle) - dx * Math.sin(angle),
          } }
        })
        const bare = await captureViews(workbench, views)
        await customizer.addImage({ src: artwork(false), role: 'background' })
        const opaque = await captureViews(workbench, views)
        await customizer.addImage({ src: artwork(), role: 'background' })
        const patched = await captureViews(workbench, views)
        const bands = [0, 0, 0, 0]
        let restoredBasePixels = 0
        for (let index = 0; index < views.length; index += 1) {
          assert(bare[index].width === opaque[index].width && bare[index].height === opaque[index].height, 'real model framebuffer resized during comparison')
          const before = bare[index].pixels, solid = opaque[index].pixels, after = patched[index].pixels
          for (let offset = 0; offset < before.length; offset += 4) {
            if (solid[offset + 3] < 200) continue
            const change = Math.max(...[0, 1, 2].map((channel) => Math.abs(solid[offset + channel] - before[offset + channel])))
            if (change < 40) continue
            const r = solid[offset], g = solid[offset + 1], b = solid[offset + 2]
            if (r > g + 50 && r > b + 50) bands[0] += 1
            if (g > r + 50 && g > b + 30) bands[1] += 1
            if (b > r + 50 && b > g + 30) bands[2] += 1
            if (r > b + 50 && g > b + 50) bands[3] += 1
            if ([0, 1, 2, 3].every((channel) => Math.abs(after[offset + channel] - before[offset + channel]) <= 3)) restoredBasePixels += 1
          }
        }
        const result = { label, info, bands, restoredBasePixels }
        evidence.cases.push(result)
        evidence.images[`${label}-front`] = framePng(patched[0])
        evidence.images[`${label}-back`] = framePng(patched[2])
        if (mode === 'fit-bounds') {
          assert(bands.every((count) => count > 100), `real model still collapsed a color band; ${JSON.stringify(result)}`)
          assert(restoredBasePixels > 100, `real model transparency did not preserve its PBR base; ${JSON.stringify(result)}`)
          const saved = customizer.saveDesign()
          assert(saved.version === 2, 'real model did not save its numerical mapping')
          const view = views[0]
          customizer.setViewState(view)
          const beforeRestore = await capture(workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!)
          workbench.destroy()
          workbench = await createWorkbench({ container: host, product: { modelUrl, modelRevision }, initialDesign: saved })
          workbench.customizer.setViewState(view)
          const restored = await capture(workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!)
          assert(JSON.stringify(workbench.customizer.saveDesign()) === JSON.stringify(saved), 'real model restore changed its design')
          assert(restored.width === beforeRestore.width && restored.height === beforeRestore.height && restored.pixels.every((value, index) => Math.abs(value - beforeRestore.pixels[index]) <= 3), 'real model restored with a different rendered mapping')
          await workbench.customizer.loadProduct({})
          assert(workbench.customizer.getPrintSurfaceInfo().mapping.domain.minU === 0, 'real model mapping leaked into the bundled cup')
        } else {
          assert(bands[0] > 100 && bands.slice(1).every((count) => count === 0), `original mode unexpectedly changed legacy clamping; ${JSON.stringify(result)}`)
        }
        workbench.destroy()
        workbench = undefined
      }
    }
    const output = document.createElement('script')
    output.type = 'application/json'
    output.id = 'customforge-real-model-evidence'
    output.textContent = JSON.stringify(evidence)
    document.head.append(output)
  } finally {
    workbench?.destroy()
    host.replaceChildren()
  }
}

async function capture(canvas: HTMLCanvasElement) {
  // Fabric 绘制后，桥接层下一帧才标记纹理更新；Viewer 可能先于桥接层运行，第三帧再读取 GPU
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return new Promise<{ width: number; height: number; pixels: Uint8Array }>((resolve, reject) => {
    requestAnimationFrame(() => {
      try {
        const context = canvas.getContext('webgl2')
        assert(context, 'WebGL2 context is unavailable')
        const { drawingBufferWidth: width, drawingBufferHeight: height } = context
        const pixels = new Uint8Array(width * height * 4)
        context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
        resolve({ width, height, pixels })
      } catch (error) { reject(error) }
    })
  })
}

async function captureSurface(workbench: CustomForgeWorkbenchApi) {
  const customizer = workbench.customizer
  const { position, target } = customizer.getViewState()
  const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z)
  customizer.setViewState({ position: { x: 0, y: 0, z: distance }, target: { x: 0, y: 0, z: 0 } })
  const canvas = workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')
  assert(canvas, 'viewer canvas is missing')
  const { width, height, pixels } = await capture(canvas)
  let minX = width, maxX = -1, minY = height, maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 200) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }
  }
  const geometry = {
    surface: customizer.getPrintSurfaceInfo(),
    view: customizer.getViewState(),
    framebuffer: { width, height },
    modelPixels: { minX, maxX, minY, maxY },
  }
  assert(maxX > minX && maxY > minY, `fixture produced no visible model pixels; ${JSON.stringify(geometry)}`)
  const sample = (u: number, v: number) => {
    const x = Math.round(minX + (maxX - minX) * u)
    const y = Math.round(minY + (maxY - minY) * v)
    const offset = (y * width + x) * 4
    return Array.from(pixels.slice(offset, offset + 3))
  }
  return { geometry, sample }
}

async function captureBaseColor(workbench: CustomForgeWorkbenchApi, u = 0.5, v = 0.5): Promise<number[]> {
  const { geometry, sample } = await captureSurface(workbench)
  const base = sample(u, v)
  assert(base[1] > base[0] + 50 && base[2] > base[0] + 50, `fixture base material is not cyan; ${JSON.stringify({ ...geometry, base })}`)
  return base
}

async function verifyColors(workbench: CustomForgeWorkbenchApi, scenario: string, flipped: boolean, expectedBase: readonly number[], mirrored = false) {
  document.body.dataset.smokePhase = `print-mapping-contract:${scenario}:flipY=${flipped}`
  const { geometry, sample } = await captureSurface(workbench)
  const colors = [0.125, 0.375, 0.625, 0.875].map((u) => sample(mirrored ? 1 - u : u, 0.5))
  const top = sample(0.75, flipped ? 0.96 : 0.04)
  const bottom = sample(0.75, flipped ? 0.04 : 0.96)
  const base = sample(mirrored ? 0.125 : 0.875, flipped ? 0.34 : 0.66)
  const details = JSON.stringify({ scenario, flipped, mirrored, ...geometry, colors, top, bottom, base, expectedBase })
  const checkColor = (condition: boolean, message: string) => assert(condition, `${message}; ${details}`)
  checkColor(colors[0][0] > colors[0][1] + 50 && colors[0][0] > colors[0][2] + 50, 'red band did not map to its own UV region')
  checkColor(colors[1][1] > colors[1][0] + 50 && colors[1][1] > colors[1][2] + 30, 'green band did not map to its own UV region')
  checkColor(colors[2][2] > colors[2][0] + 50, 'blue band did not map to its own UV region')
  checkColor(colors[3][0] > colors[3][2] + 50 && colors[3][1] > colors[3][2] + 50, 'yellow band did not map to its own UV region')
  checkColor(top.every((value) => value > 200) && bottom.every((value) => value < 100), 'vertical direction flipped zero or two times')
  // ACES 会改变青色各通道，透明区应与同一渲染链路中的原底材一致，而不是与未色调映射的 RGB 比较
  checkColor(base.every((value, index) => Math.abs(value - expectedBase[index]) <= 3), 'transparent design changed the original base material')
}

async function expectFailure(operation: Promise<unknown>, code: string) {
  let failure: unknown
  try { await operation } catch (error) { failure = error }
  assert(failure instanceof PrintSurfaceError && failure.code === code, `expected ${code}`)
}

async function verifyMappedBaseAndCleanup(host: HTMLElement): Promise<void> {
  document.body.dataset.smokePhase = 'print-mapping-contract:pbr-base-and-cleanup'
  const mapped = createPrintMappingFixture(false, false, { width: 256, height: 128 }, true, true)
  const missing = createPrintMappingFixture(false, true, { width: 256, height: 128 }, true, true)
  const decoded = new Set<ImageBitmap>()
  const closed = new Map<ImageBitmap, number>()
  const decode = window.createImageBitmap
  const close = ImageBitmap.prototype.close
  let workbench: CustomForgeWorkbenchApi | undefined
  window.createImageBitmap = function (...args: unknown[]) {
    return (Reflect.apply(decode, window, args) as Promise<ImageBitmap>).then((bitmap) => { decoded.add(bitmap); return bitmap })
  } as typeof window.createImageBitmap
  ImageBitmap.prototype.close = function () {
    if (decoded.has(this)) closed.set(this, (closed.get(this) ?? 0) + 1)
    close.call(this)
  }
  try {
    workbench = await createWorkbench({ container: host, readModelMetadata: true, product: { modelUrl: mapped.modelUrl } })
    const before = await captureSurface(workbench)
    const positions = [0.8, 0.86, 0.92].flatMap((u) => [0.6, 0.66, 0.72].map((v) => ({ u, v, color: before.sample(u, v) })))
    assert(new Set(positions.map(({ color }) => color.join(','))).size > 1, 'PBR fixture did not render its transformed checker texture')
    await workbench.customizer.addImage({ src: artwork(), role: 'background' })
    const after = await captureSurface(workbench)
    for (const { u, v, color } of positions) {
      const actual = after.sample(u, v)
      assert(actual.every((value, index) => Math.abs(value - color[index]) <= 3), `PBR texture transform changed under transparent design at ${u},${v}: ${actual} vs ${color}`)
    }
    const designPixel = after.sample(0.125, 0.5)
    assert(designPixel[0] > designPixel[1] + 50 && designPixel[0] > designPixel[2] + 50, 'PBR texture suppressed the opaque design layer')
    await expectFailure(workbench.customizer.loadProduct({ modelUrl: missing.modelUrl }), 'PRINT_UV_MISSING')
    const canvas = workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!
    const context = canvas.getContext('webgl2')!
    workbench.destroy()
    workbench = undefined
    assert(decoded.size > 0, 'mapped GLB did not exercise ImageBitmap decoding')
    assert([...decoded].every((bitmap) => closed.get(bitmap) === 1), `GLB images were not released exactly once: ${decoded.size} decoded, ${closed.size} closed`)
    assert(context.isContextLost(), 'destroy retained its WebGL context')
  } finally {
    workbench?.destroy()
    window.createImageBitmap = decode
    ImageBitmap.prototype.close = close
    mapped.dispose()
    missing.dispose()
  }
}

async function verifyImageRestoreCancellation(host: HTMLElement): Promise<void> {
  document.body.dataset.smokePhase = 'print-mapping-contract:image-restore-cancellation'
  const first = createPrintMappingFixture()
  const second = createPrintMappingFixture(true)
  const delayedSource = artwork(false)
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
  let release: (() => void) | undefined
  let entered: (() => void) | undefined
  let gate = Promise.resolve()
  let workbench: CustomForgeWorkbenchApi | undefined
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...descriptor,
    set(this: HTMLImageElement, source: string) {
      if (source === delayedSource) {
        entered?.()
        void gate.then(() => descriptor.set!.call(this, source))
      } else descriptor.set!.call(this, source)
    },
  })
  try {
    workbench = await createWorkbench({ container: host, readModelMetadata: true, product: { modelUrl: first.modelUrl } })
    await workbench.customizer.addImage({ src: artwork(), role: 'background' })
    const saved = workbench.customizer.saveDesign()
    const originalImage = saved.objects.find((object) => object.type === 'image')
    assert(originalImage?.type === 'image', 'image restore test has no image layer')
    const originalSelection = workbench.customizer.getSelectedObjectIds()
    const originalHistory = workbench.customizer.getState().history
    const failedRestore = await workbench.customizer.loadDesign({ ...saved, objects: [...saved.objects, { ...originalImage, id: 'broken-image', role: 'element', src: 'data:image/png;base64,AAAA' }] }).catch((error: unknown) => error)
    assert(failedRestore instanceof Error, 'invalid image restore did not fail')
    assert(JSON.stringify(workbench.customizer.saveDesign()) === JSON.stringify(saved) && JSON.stringify(workbench.customizer.getSelectedObjectIds()) === JSON.stringify(originalSelection) && JSON.stringify(workbench.customizer.getState().history) === JSON.stringify(originalHistory), 'failed image restore replaced design, selection or history')
    for (const action of ['switch', 'destroy'] as const) {
      const active = workbench
      assert(active, 'image restore test has no active workbench')
      const saved = active.customizer.saveDesign()
      const loading = { ...saved, objects: saved.objects.map((object) => object.type === 'image' ? { ...object, src: delayedSource } : object) }
      const started = new Promise<void>((resolve) => { entered = resolve })
      gate = new Promise<void>((resolve) => { release = resolve })
      const restore = active.customizer.loadDesign(loading).catch((error: unknown) => error)
      await started
      if (action === 'switch') {
        await active.customizer.loadProduct({ modelUrl: second.modelUrl })
        const current = active.customizer.getState()
        release!()
        const failure = await restore
        assert(failure instanceof DOMException && failure.name === 'AbortError', 'pending image restore committed after a product switch')
        const after = active.customizer.getState()
        const changed = (Object.keys(current) as Array<keyof typeof current>).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(current[key]))
        const stableView = (['position', 'target'] as const).every((part) => (['x', 'y', 'z'] as const).every((axis) => Math.abs(current.view[part][axis] - after.view[part][axis]) <= 1e-12 * Math.max(1, Math.abs(current.view[part][axis]))))
        assert(changed.every((key) => key === 'view') && stableView, `cancelled image restore changed state: ${changed}; views ${JSON.stringify([current.view, after.view])}`)
      } else {
        active.destroy()
        workbench = undefined
        release!()
        const failure = await restore
        assert(failure instanceof DOMException && failure.name === 'AbortError', 'pending image restore committed after destroy')
        assert(host.childElementCount === 0, 'pending image restore recreated a destroyed editor')
      }
    }
  } finally {
    release?.()
    Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor)
    workbench?.destroy()
    first.dispose()
    second.dispose()
  }
}

/**
 * 使用打包后的公开入口回归负 UV、方向、双通道、元数据、保存恢复与切换事务
 *
 * 像素读取仅存在于测试消费者，不能导入 SDK 生产渲染路径
 */
export async function verifyPrintMappingSmoke(): Promise<void> {
  const negative = createPrintMappingFixture()
  const standard = createPrintMappingFixture(true)
  const missing = createPrintMappingFixture(false, true)
  const delayed = createPrintMappingFixture()
  const invalidSize = createPrintMappingFixture(false, false, { width: 0, height: 128 })
  const differentSize = createPrintMappingFixture(false, false, { width: 512, height: 128 })
  const withoutMetadata = createPrintMappingFixture(true, false, { width: 256, height: 128 }, false)
  const islands = createPrintMappingFixture(false, false, { width: 256, height: 128 }, true, false, true)
  const source = artwork()
  let workbench: CustomForgeWorkbenchApi | undefined
  let headless: ProductCustomizerApi | undefined
  let releaseFetch: (() => void) | undefined
  const originalFetch = window.fetch
  let fixtureRequests = 0
  const host = document.querySelector<HTMLElement>('#app')!
  const diagnostics: PrintDiagnostic[] = []
  try {
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === negative.modelUrl) fixtureRequests += 1
      return originalFetch(input, init)
    }
    for (const textureFlipY of [false, true]) {
      workbench = await createWorkbench({
        container: host, readModelMetadata: true,
        product: { modelUrl: negative.modelUrl, textureFlipY, modelRevision: 'fixture-a' },
        onDiagnostic: (entry) => diagnostics.push(entry),
        formatDiagnostic: (entry) => `fixture:${entry.code}`,
      })
      const customizer = workbench.customizer
      const info = customizer.getPrintSurfaceInfo()
      assert(info.canvas.width === 256 && info.canvas.height === 128, 'metadata size was resolved after creating the canvas')
      assert(info.mapping.domain.minU === -2 && info.mapping.domain.maxU === -1, 'negative domain was not fitted')
      assert(workbench.element.querySelector('[data-role="resolution"]')?.textContent === '256 x 128', 'Workbench label uses defaults instead of resolved sizes')
      if (!textureFlipY) assert(fixtureRequests === 1, 'one initialization fetched the GLB more than once')
      const baseColor = await captureBaseColor(workbench)
      await customizer.addImage({ src: source, role: 'background' })
      await verifyColors(workbench, 'negative-uv/new-design', textureFlipY, baseColor)
      const saved = customizer.saveDesign()
      assert(saved.version === 2 && saved.printMapping.textureFlipY === textureFlipY, 'new mapping was not saved as numerical Schema 2')
      const png = customizer.getTextureDataUrl()
      customizer.selectObjects(customizer.getObjects().map((entry) => entry.id))
      assert(customizer.getTextureDataUrl() === png, 'selection controls entered the exported texture')
      const text = customizer.addText({ text: 'UV →', x: 30, y: 30, width: 100, fontSize: 16 })
      assert(await customizer.undo(), 'new mapping undo failed')
      assert(await customizer.redo(), 'new mapping redo failed')
      assert(customizer.getObjects().some((entry) => entry.id === text.id), 'redo lost the text object')
      await customizer.loadDesign(saved)
      assert(JSON.stringify(customizer.saveDesign()) === JSON.stringify(saved), 'runtime restore changed mapping or layer data')
      await expectFailure(customizer.loadDesign({ ...saved, canvas: { width: 300, height: 128 } }), 'CANVAS_SIZE_MISMATCH')
      await expectFailure(customizer.loadDesign({ ...saved, printMapping: { ...saved.printMapping, uvChannel: 1 } }), 'DESIGN_MAPPING_MISMATCH')
      workbench.destroy()
      workbench = await createWorkbench({ container: host, readModelMetadata: true, initialDesign: saved, product: { modelUrl: negative.modelUrl, modelRevision: 'fixture-a' } })
      assert(workbench.customizer.getPrintSurfaceInfo().modelRevisionVerified, 'saved content version was not verified')
      assert(JSON.stringify(workbench.customizer.saveDesign()) === JSON.stringify(saved), 'initialDesign changed saved mapping or objects')
      await verifyColors(workbench, 'negative-uv/restored-design', textureFlipY, baseColor)
      const beforeFailure = JSON.stringify(workbench.customizer.getState())
      await expectFailure(workbench.customizer.loadProduct({ modelUrl: missing.modelUrl }), 'PRINT_UV_MISSING')
      assert(JSON.stringify(workbench.customizer.getState()) === beforeFailure, 'failed product load changed active state')
      await expectFailure(workbench.customizer.loadProduct({ modelUrl: invalidSize.modelUrl }), 'CANVAS_SIZE_INVALID')
      await expectFailure(workbench.customizer.loadProduct({ modelUrl: differentSize.modelUrl }), 'CANVAS_SIZE_MISMATCH')
      assert(JSON.stringify(workbench.customizer.getState()) === beforeFailure, 'invalid metadata or incompatible size changed active state')
      await workbench.customizer.loadProduct({ modelUrl: standard.modelUrl })
      const reset = workbench.customizer.getPrintSurfaceInfo()
      assert(reset.mapping.uvChannel === 0 && reset.mapping.domain.minU === 0 && reset.mapping.domain.maxU === 1 && !reset.mapping.textureFlipY, 'product switch retained old mapping fields')
      await verifyColors(workbench, 'standard-uv/product-switch', false, baseColor)
      workbench.destroy()
      workbench = undefined
    }
    for (const textureFlipY of [false, true]) {
      workbench = await createWorkbench({ container: host, readModelMetadata: true, product: { modelUrl: islands.modelUrl, textureFlipY } })
      const base = await captureBaseColor(workbench, 0.875, 0.66)
      await workbench.customizer.addImage({ src: source, role: 'background' })
      await verifyColors(workbench, 'multiple-islands/preserved-gap', textureFlipY, base)
      const { geometry } = await captureSurface(workbench)
      const frame = await capture(workbench.element.querySelector<HTMLCanvasElement>('.customforge-viewer-canvas')!)
      const x = Math.round((geometry.modelPixels.minX + geometry.modelPixels.maxX) / 2)
      const y = Math.round((geometry.modelPixels.minY + geometry.modelPixels.maxY) / 2)
      assert(frame.pixels[(y * frame.width + x) * 4 + 3] === 0, 'fitting UV islands filled their physical gap')
      workbench.destroy()
      workbench = undefined
    }
    assert(diagnostics.length > 0, 'initial diagnostics were unavailable to the consumer')
    for (const uvChannel of [1, 2, 3] as const) {
      workbench?.destroy()
      workbench = await createWorkbench({ container: host, editorWidth: 256, editorHeight: 128, product: { modelUrl: negative.modelUrl, uvChannel, uvMapping: { mode: 'fit-bounds' } } })
      const mirroredBaseColor = await captureBaseColor(workbench)
      await workbench.customizer.addImage({ src: source, role: 'background' })
      await verifyColors(workbench, `uv${uvChannel}/mirrored-design`, false, mirroredBaseColor, true)
    }
    assert(workbench, 'UV channel tests did not create a workbench')
    const gate = new Promise<void>((resolve) => { releaseFetch = resolve })
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === delayed.modelUrl) await gate
      return originalFetch(input, init)
    }
    const cancelled = workbench.customizer.loadProduct({ modelUrl: delayed.modelUrl, uvMapping: { mode: 'fit-bounds' } }).catch((error: unknown) => error)
    await workbench.customizer.loadProduct({ modelUrl: standard.modelUrl })
    releaseFetch!()
    const cancellation = await cancelled
    assert(cancellation instanceof DOMException && cancellation.name === 'AbortError', 'superseded request committed stale product data')
    const destructionGate = new Promise<void>((resolve) => { releaseFetch = resolve })
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === delayed.modelUrl) await destructionGate
      return originalFetch(input, init)
    }
    const destroyedLoad = workbench.customizer.loadProduct({ modelUrl: delayed.modelUrl }).catch((error: unknown) => error)
    workbench.destroy()
    workbench = undefined
    releaseFetch!()
    const destroyedResult = await destroyedLoad
    assert(destroyedResult instanceof DOMException && destroyedResult.name === 'AbortError', 'destroyed instance accepted a pending product')
    window.fetch = originalFetch
    const legacy: DesignDocument = { version: 1, canvas: { width: 320, height: 160 }, objects: [] }
    workbench = await createWorkbench({ container: host, readModelMetadata: true, initialDesign: legacy, product: { modelUrl: negative.modelUrl, textureFlipY: true } })
    assert(workbench.customizer.saveDesign().version === 1 && workbench.customizer.getCanvasSize().width === 320, 'Schema 1 restore adopted model metadata or changed schema')
    await workbench.customizer.loadProduct({ modelUrl: withoutMetadata.modelUrl })
    const retained = workbench.customizer.getPrintSurfaceInfo()
    assert(retained.canvas.width === 320 && retained.sources.canvas === 'instance', 'undeclared product size replaced the instance canvas')
    assert(retained.diagnostics.some((entry) => entry.code === 'CANVAS_METADATA_MISSING'), 'missing enabled metadata was not diagnosed')
    const retainedSnapshot = JSON.stringify(workbench.customizer.getPrintSurfaceInfo())
    retained.mapping.domain.minU = -999
    retained.diagnostics.length = 0
    assert(JSON.stringify(workbench.customizer.getPrintSurfaceInfo()) === retainedSnapshot, 'consumer mutation changed the internal mapping snapshot')
    workbench.destroy()
    workbench = undefined
    host.replaceChildren()
    const editor = document.createElement('div')
    const viewer = document.createElement('div')
    editor.style.cssText = viewer.style.cssText = 'width:100%;height:320px'
    host.append(editor, viewer)
    headless = await createCustomizer({ editor, viewer, readModelMetadata: true, product: { modelUrl: negative.modelUrl } })
    assert(headless.getCanvasSize().width === 256 && headless.getPrintSurfaceInfo().mapping.domain.minU === -2, 'headless and Workbench configuration diverged')
    await expectFailure(headless.loadDesign({ ...legacy, canvas: { width: 256, height: 128 } }), 'DESIGN_MAPPING_MISMATCH')
    const unverified = headless.saveDesign()
    assert(unverified.version === 2, 'metadata mapping did not create Schema 2')
    for (const modelRevision of ['fixture-a', 'fixture-b']) {
      const document = { ...unverified, printMapping: { ...unverified.printMapping, modelRevision } }
      await headless.loadDesign(document)
      assert(JSON.stringify(headless.saveDesign()) === JSON.stringify(document), 'runtime restore discarded a saved model revision')
      assert(!headless.getPrintSurfaceInfo().modelRevisionVerified, 'a document revision was incorrectly treated as model identity proof')
    }
    headless.destroy()
    headless = await createCustomizer({ editor, viewer, readModelMetadata: true, product: { modelUrl: negative.modelUrl, modelRevision: 'fixture-a' } })
    const matching = { ...unverified, printMapping: { ...unverified.printMapping, modelRevision: 'fixture-a' } }
    await headless.loadDesign(matching)
    assert(headless.getPrintSurfaceInfo().modelRevisionVerified, 'runtime restore did not verify matching declared model content')
    assert(!headless.getPrintSurfaceInfo().diagnostics.some((entry) => entry.code === 'MODEL_REVISION_UNVERIFIED'), 'matching runtime restore retained an obsolete identity warning')
    await headless.loadDesign(unverified)
    assert(!headless.getPrintSurfaceInfo().modelRevisionVerified, 'a document without revision inherited a verified identity')
    assert(JSON.stringify(headless.saveDesign()) === JSON.stringify(unverified), 'restore silently added the host revision to the saved document')
    assert(await headless.undo(), 'restored revision history undo failed')
    assert(headless.getPrintSurfaceInfo().modelRevisionVerified, 'undo did not refresh restored identity verification')
    assert(await headless.redo(), 'restored revision history redo failed')
    assert(!headless.getPrintSurfaceInfo().modelRevisionVerified, 'redo did not refresh restored identity verification')
    const beforeRevisionFailure = JSON.stringify(headless.getState())
    await expectFailure(headless.loadDesign({ ...unverified, printMapping: { ...unverified.printMapping, modelRevision: 'fixture-b' } }), 'DESIGN_MAPPING_MISMATCH')
    assert(JSON.stringify(headless.getState()) === beforeRevisionFailure, 'revision conflict changed the current design or verification state')
    headless.destroy()
    headless = undefined
    host.replaceChildren()
    await verifyImageRestoreCancellation(host)
    await verifyMappedBaseAndCleanup(host)
    document.body.dataset.printMappingSmoke = 'passed'
  } finally {
    releaseFetch?.()
    window.fetch = originalFetch
    headless?.destroy()
    workbench?.destroy()
    negative.dispose(); standard.dispose(); missing.dispose(); delayed.dispose()
    invalidSize.dispose(); differentSize.dispose(); withoutMetadata.dispose()
    islands.dispose()
    host.replaceChildren()
  }
}
