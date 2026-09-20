import {
  createCustomizer,
  type CustomizerState,
  type ProductCustomizerApi,
} from 'customforge'
import {
  createWorkbench,
  type CustomForgeWorkbenchApi,
} from 'customforge/workbench'
import 'customforge/style.css'
import './styles.css'

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

const workbench: CustomForgeWorkbenchApi = await createWorkbench({
  container: '#app',
  className: 'package-contract-test',
  branding: {
    title: 'Package API test',
    subtitle: 'Installed from the local npm artifact',
  },
  appearance: {
    editor: { controlSize: 6, objectBorder: '#0057b8' },
    viewer: { backgroundColor: '#f4f4f5' },
  },
})

const customizer: ProductCustomizerApi = workbench.customizer
const text = customizer.addText({
  text: 'PACKAGE API',
  name: 'Contract label',
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
workbench.setTheme({ accent: '#0057b8', accentHover: '#00458f' })
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

window.addEventListener('beforeunload', () => {
  stopViewChange()
  workbench.destroy()
}, { once: true })

void createHeadless
