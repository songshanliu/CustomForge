import {
  createCustomizer,
  type CustomizerState,
  type ProductCustomizerApi,
} from 'customforge'
import {
  createWorkbench,
  type CustomForgeWorkbenchApi,
  type WorkbenchExtensionButton,
} from 'customforge/workbench'
import 'customforge/style.css'
import './styles.css'

const brandLogoUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="12" fill="#17352f"/>
    <path d="M12 34V14l24 20V14" fill="none" stroke="#d9f99d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="36" cy="12" r="4" fill="#72d6bc"/>
  </svg>
`)}`

const extensionButtons: WorkbenchExtensionButton[] = [
  {
    id: 'northline.png-snapshot',
    placement: 'globalActions',
    label: 'PNG snapshot',
    variant: 'primary',
    order: 10,
    onClick: async ({ customizer, workbench }) => {
      const blob = await customizer.getTextureBlob()
      workbench.setStatus(`PNG snapshot ready (${blob.size} bytes)`)
    },
  },
  {
    id: 'northline.select-all',
    placement: 'editorToolbar',
    label: 'Select all',
    order: 10,
    disabled: ({ state }) =>
      state.objects.filter((object) => object.visible !== false).length < 2,
    onClick: ({ customizer, state }) => {
      customizer.selectObjects(
        state.objects
          .filter((object) => object.visible !== false)
          .map((object) => object.id),
      )
    },
  },
  {
    id: 'northline.straighten',
    placement: 'selectionToolbar',
    label: 'Straighten',
    order: 10,
    visible: ({ selection }) =>
      selection.some((object) => object.transform.rotation !== 0),
    disabled: ({ selection }) =>
      selection.some((object) => object.locked === true),
    onClick: ({ customizer, selection }) => {
      selection.forEach((object) => {
        customizer.updateObjectTransform(object.id, { rotation: 0 })
      })
    },
  },
  {
    id: 'northline.center-layer',
    placement: 'layerActions',
    label: 'Center',
    order: 10,
    disabled: ({ layer }) =>
      !layer || layer.locked === true ||
      (layer.type === 'image' && layer.role === 'background'),
    onClick: ({ customizer, layer, state }) => {
      if (!layer) {
        return
      }
      customizer.updateObjectTransform(layer.id, {
        x: state.printableBounds.left + state.printableBounds.width / 2,
        y: state.printableBounds.top + state.printableBounds.height / 2,
      })
    },
  },
]

async function createHeadless(
  editor: HTMLElement,
  viewer: HTMLElement,
): Promise<ProductCustomizerApi> {
  return createCustomizer({
    editor,
    viewer,
    appearance: {
      editor: { controlSize: 6, uvBoundary: '#d92d20' },
      viewer: { backgroundColor: '#f4f4f5' },
    },
  })
}

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = window.setTimeout(() => reject(new Error(message)), 2_000)
      }),
    ])
  } finally {
    if (timeout !== undefined) {
      window.clearTimeout(timeout)
    }
  }
}

function waitForNonblankRender(host: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | undefined
    const timeout = window.setTimeout(() => {
      observer?.disconnect()
      reject(new Error('3D model disappeared at maximum zoom-out'))
    }, 2_000)
    const finish = (): void => {
      window.clearTimeout(timeout)
      observer?.disconnect()
      resolve()
    }
    const checkState = (): void => {
      if (host.dataset.renderState === 'nonblank') {
        finish()
      }
    }

    observer = new MutationObserver(checkState)
    observer.observe(host, {
      attributes: true,
      attributeFilter: ['data-render-state'],
    })
    checkState()
  })
}

async function runBrowserSmoke(
  activeWorkbench: CustomForgeWorkbenchApi,
  activeCustomizer: ProductCustomizerApi,
  stopViewListener: () => void,
): Promise<void> {
  document.body.dataset.smokeStatus = 'running'
  try {
    const initialState = activeCustomizer.getState()
    assertSmoke(initialState.product.surfaceMesh === 'PrintArea', 'Model did not initialize')
    assertSmoke(initialState.printableBounds.width > 0, 'Printable bounds are empty')

    activeCustomizer.clearHistory()
    const smokeText = activeCustomizer.addText({
      text: 'SMOKE TEST',
      name: 'Smoke text',
      x: 180,
      y: 160,
      fontSize: 36,
    })
    const smokeImage = await activeCustomizer.addImage({
      src: brandLogoUrl,
      name: 'Smoke image',
      x: 700,
      y: 260,
      width: 120,
    })
    assertSmoke(
      activeCustomizer.selectObjects([smokeText.id, smokeImage.id]),
      'Multi-selection failed',
    )

    const transformed = activeCustomizer.updateObjectTransform(smokeImage.id, {
      x: 640,
      y: 240,
      rotation: 13,
      scaleX: 0.9,
      scaleY: 0.9,
    })
    assertSmoke(transformed?.transform.rotation === 13, 'Object transform failed')
    const savedDesign = activeCustomizer.saveDesign()

    assertSmoke(await activeCustomizer.undo(), 'Undo failed')
    assertSmoke(await activeCustomizer.redo(), 'Redo failed')
    assertSmoke(
      activeCustomizer.getObjects()
        .find(({ id }) => id === smokeImage.id)
        ?.transform.rotation === 13,
      'Redo did not restore the transform',
    )

    assertSmoke(activeCustomizer.removeObject(smokeText.id), 'Object removal failed')
    await activeCustomizer.loadDesign(savedDesign)
    assertSmoke(
      activeCustomizer.getObjects().length === savedDesign.objects.length,
      'Design restore changed the object count',
    )

    const png = await activeCustomizer.getTextureBlob()
    assertSmoke(png.type === 'image/png' && png.size > 0, 'PNG Blob export failed')

    const originalView = activeCustomizer.getViewState()
    const movedView = activeCustomizer.setViewState({
      position: {
        ...originalView.position,
        x: originalView.position.x + 0.25,
      },
      target: originalView.target,
    })
    assertSmoke(
      Math.abs(movedView.position.x - originalView.position.x - 0.25) < 0.0001,
      '3D view restore failed',
    )
    activeCustomizer.setViewState(originalView)

    const viewerHost = activeWorkbench.element.querySelector<HTMLElement>(
      '[data-role="viewer-host"]',
    )
    const viewerCanvas = viewerHost?.querySelector<HTMLCanvasElement>(
      '.customforge-viewer-canvas',
    )
    assertSmoke(viewerHost && viewerCanvas, '3D viewer canvas was not found')
    viewerHost.dataset.renderState = 'pending'
    for (let index = 0; index < 40; index += 1) {
      viewerCanvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: viewerCanvas.clientWidth / 2,
        clientY: viewerCanvas.clientHeight / 2,
        deltaY: 100,
      }))
    }
    await waitForNonblankRender(viewerHost)
    activeCustomizer.setViewState(originalView)

    let resolveExtension: () => void = () => {}
    const extensionClicked = new Promise<void>((resolve) => {
      resolveExtension = () => resolve()
    })
    const removeSmokeExtension = activeWorkbench.registerExtension({
      id: 'smoke.runtime-command',
      placement: 'globalActions',
      label: 'Smoke command',
      onClick: () => resolveExtension(),
    })
    const extensionButton = activeWorkbench.element.querySelector<HTMLButtonElement>(
      '[data-extension-id="smoke.runtime-command"]',
    )
    assertSmoke(extensionButton, 'Runtime extension did not render')
    extensionButton.click()
    await withTimeout(extensionClicked, 'Runtime extension did not execute')
    removeSmokeExtension()
    assertSmoke(
      !activeWorkbench.getExtensions()
        .some(({ id }) => id === 'smoke.runtime-command'),
      'Runtime extension did not unregister',
    )

    stopViewListener()
    activeWorkbench.destroy()
    const rebuiltWorkbench = await createWorkbench({ container: '#app' })
    assertSmoke(
      rebuiltWorkbench.customizer.getProduct().surfaceMesh === 'PrintArea',
      'Workbench did not rebuild after destroy',
    )
    rebuiltWorkbench.destroy()
    document.body.dataset.smokeStatus = 'passed'
  } catch (error) {
    document.body.dataset.smokeStatus = 'failed'
    document.body.dataset.smokeError = error instanceof Error
      ? error.message
      : String(error)
    throw error
  }
}

const workbench: CustomForgeWorkbenchApi = await createWorkbench({
  container: '#app',
  className: 'package-contract-test',
  branding: {
    logoUrl: brandLogoUrl,
    logoAlt: 'Northline Studio',
    title: 'Northline Studio',
    subtitle: 'Custom goods workshop',
  },
  labels: {
    editorTitle: 'Artwork desk',
    viewerTitle: 'Live mockup',
    layers: 'Objects',
  },
  theme: {
    ink: '#15231f',
    muted: '#64736d',
    border: '#d6e0dc',
    surface: '#ffffff',
    surfaceMuted: '#f3f7f5',
    stage: '#e8efec',
    accent: '#0f766e',
    accentHover: '#0b5e58',
    accentContrast: '#ffffff',
    danger: '#b5473d',
    controlRadius: '7px',
  },
  appearance: {
    editor: {
      controlSize: 6,
      objectBorder: '#0f766e',
      controlBorder: '#0f766e',
      selectionBorder: '#0f766e',
      selectionFill: 'rgba(15, 118, 110, 0.1)',
      uvFill: 'rgba(15, 118, 110, 0.06)',
      uvBoundary: '#dc6b4e',
    },
    viewer: { backgroundColor: '#e8efec' },
  },
  extensions: extensionButtons,
})

const customizer: ProductCustomizerApi = workbench.customizer
const text = customizer.addText({
  text: 'NORTHLINE',
  name: 'Front artwork',
  x: 160,
  y: 210,
  fontSize: 48,
})

customizer.selectObjects([text.id])
customizer.updateObjectTransform(text.id, {
  x: 512,
  y: 256,
  rotation: -8,
  scaleX: 1.1,
  scaleY: 1.1,
})

const state: CustomizerState = customizer.getState()
const view = customizer.getViewState()
customizer.setViewState(view)

const textureDataUrl = customizer.getTextureDataUrl()
const textureBlob = await customizer.getTextureBlob()
const stopViewChange = customizer.on('viewchange', ({ position }) => {
  document.body.dataset.cameraX = position.x.toFixed(2)
})

workbench.setFeature('textFormatting', true)
workbench.setLayout('layers', true)
workbench.setTheme({ accent: '#0f766e', accentHover: '#0b5e58' })
workbench.setStatus(
  `${state.objects.length} object, ${textureBlob.size} byte PNG`,
)

document.body.dataset.texturePrefix = textureDataUrl.slice(0, 22)
document.body.dataset.canvasSize =
  `${customizer.getCanvasSize().width}x${customizer.getCanvasSize().height}`
document.body.dataset.printableWidth =
  String(customizer.getPrintableBounds().width)
document.body.dataset.productMesh = customizer.getProduct().surfaceMesh
document.body.dataset.themeAccent = workbench.getTheme().accent
document.body.dataset.featureCount =
  String(Object.keys(workbench.getFeatures()).length)
document.body.dataset.layoutCount = String(Object.keys(workbench.getLayout()).length)
document.body.dataset.extensionCount = String(workbench.getExtensions().length)

window.addEventListener('beforeunload', () => {
  stopViewChange()
  workbench.destroy()
}, { once: true })

if (new URLSearchParams(window.location.search).get('smoke') === '1') {
  await runBrowserSmoke(workbench, customizer, stopViewChange)
}

void createHeadless
