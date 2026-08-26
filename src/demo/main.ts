import {
  Box,
  Download,
  ImagePlus,
  Link2,
  RotateCcw,
  Trash2,
  Type,
  Upload,
  X,
  createIcons,
} from 'lucide'
import { createCustomizer } from '../index'
import './styles.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Application root was not found')
}

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div class="brand" aria-label="Open Product Customizer">
        <span class="brand-mark"><i data-lucide="box"></i></span>
        <span class="brand-copy">
          <strong>Open Product Customizer</strong>
          <span>Texture pipeline prototype</span>
        </span>
      </div>

      <div class="topbar-actions">
        <span class="status" id="app-status" role="status">
          <span class="status-dot"></span>
          <span id="status-label">Starting</span>
        </span>
        <button class="button button-secondary" id="remote-button" type="button">
          <i data-lucide="link-2"></i>
          Load remote
        </button>
        <button class="button button-primary" id="export-button" type="button">
          <i data-lucide="download"></i>
          Export PNG
        </button>
      </div>
    </header>

    <section class="workbench" aria-label="Product customization workbench">
      <section class="workspace-panel editor-panel" aria-labelledby="editor-title">
        <header class="panelbar">
          <div>
            <span class="panel-index">01</span>
            <h1 id="editor-title">UV workspace</h1>
          </div>
          <span class="resolution">1024 × 512</span>
        </header>

        <div class="toolstrip" role="toolbar" aria-label="Design tools">
          <button class="tool-button" id="add-text-button" type="button">
            <i data-lucide="type"></i>
            Add text
          </button>
          <button class="tool-button" id="add-image-button" type="button">
            <i data-lucide="image-plus"></i>
            Add image
          </button>
          <span class="tool-separator" aria-hidden="true"></span>
          <button
            class="icon-button"
            id="delete-button"
            type="button"
            title="Delete selected object"
            aria-label="Delete selected object"
            disabled
          >
            <i data-lucide="trash-2"></i>
          </button>
        </div>

        <div class="editor-stage" id="editor-host"></div>
        <input id="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
      </section>

      <section class="workspace-panel viewer-panel" aria-labelledby="viewer-title">
        <header class="panelbar viewer-panelbar">
          <div>
            <span class="panel-index">02</span>
            <h2 id="viewer-title">Live product</h2>
          </div>
          <button
            class="icon-button"
            id="reset-view-button"
            type="button"
            title="Reset 3D view"
            aria-label="Reset 3D view"
          >
            <i data-lucide="rotate-ccw"></i>
          </button>
        </header>
        <div class="viewer-stage" id="viewer-host">
          <div class="viewer-loading">Preparing 3D scene</div>
        </div>
      </section>
    </section>
  </main>

  <dialog class="load-dialog" id="load-dialog">
    <form method="dialog" id="remote-form">
      <header class="dialog-header">
        <div>
          <span class="dialog-kicker">Product source</span>
          <h2>Load remote assets</h2>
        </div>
        <button
          class="icon-button"
          id="close-dialog-button"
          type="button"
          title="Close"
          aria-label="Close"
        >
          <i data-lucide="x"></i>
        </button>
      </header>

      <div class="form-fields">
        <label>
          <span>GLB / GLTF URL</span>
          <div class="input-shell">
            <i data-lucide="link-2"></i>
            <input id="model-url" name="modelUrl" type="url" placeholder="https://example.com/product.glb" />
          </div>
        </label>

        <label>
          <span>Base texture URL</span>
          <div class="input-shell">
            <i data-lucide="image-plus"></i>
            <input id="texture-url" name="textureUrl" type="url" placeholder="https://example.com/texture.png" />
          </div>
        </label>

        <label>
          <span>Customizable mesh</span>
          <input id="mesh-name" name="meshName" type="text" value="PrintArea" required />
        </label>

        <label class="check-field">
          <input id="flip-texture" name="flipTexture" type="checkbox" />
          <span>Flip texture vertically</span>
        </label>
      </div>

      <footer class="dialog-actions">
        <button class="button button-secondary" id="demo-button" type="button">Use built-in demo</button>
        <button class="button button-primary" id="load-button" type="submit">
          <i data-lucide="upload"></i>
          Load product
        </button>
      </footer>
    </form>
  </dialog>
`

createIcons({
  icons: {
    Box,
    Download,
    ImagePlus,
    Link2,
    RotateCcw,
    Trash2,
    Type,
    Upload,
    X,
  },
  attrs: {
    width: 18,
    height: 18,
    'stroke-width': 1.8,
  },
})

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Required UI element was not found: ${selector}`)
  }
  return element
}

const statusLabel = requiredElement<HTMLSpanElement>('#status-label')
const status = requiredElement<HTMLSpanElement>('#app-status')
const editorHost = requiredElement<HTMLDivElement>('#editor-host')
const deleteButton = requiredElement<HTMLButtonElement>('#delete-button')
const imageInput = requiredElement<HTMLInputElement>('#image-input')
const dialog = requiredElement<HTMLDialogElement>('#load-dialog')
const remoteForm = requiredElement<HTMLFormElement>('#remote-form')
const loadButton = requiredElement<HTMLButtonElement>('#load-button')

function setStatus(message: string, mode: 'ready' | 'busy' | 'error' = 'ready'): void {
  statusLabel.textContent = message
  status.dataset.mode = mode
}

setStatus('Loading demo', 'busy')

const customizer = await createCustomizer({
  editor: '#editor-host',
  viewer: '#viewer-host',
})

customizer.editor.addDemoBadge()
customizer.addText({
  text: 'MAKE IT YOURS',
  x: 96,
  y: 206,
  width: 430,
  fontSize: 66,
  color: '#172126',
})
customizer.editor.canvas.discardActiveObject()
customizer.editor.canvas.requestRenderAll()
editorHost.dataset.objectCount = String(customizer.editor.objectCount)
setStatus('Demo product ready')

customizer.on('change', ({ objectCount }) => {
  editorHost.dataset.objectCount = String(objectCount)
})
customizer.on('status', ({ message }) => setStatus(message))
customizer.on('error', ({ error }) => setStatus(error.message, 'error'))
customizer.on('selectionchange', ({ hasSelection }) => {
  deleteButton.disabled = !hasSelection
})

requiredElement<HTMLButtonElement>('#add-text-button').addEventListener('click', () => {
  customizer.addText()
})

requiredElement<HTMLButtonElement>('#add-image-button').addEventListener('click', () => {
  imageInput.click()
})

imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0]
  if (!file) {
    return
  }

  const objectUrl = URL.createObjectURL(file)
  setStatus('Loading image', 'busy')
  try {
    await customizer.addImage({ src: objectUrl })
    setStatus('Image added')
  } catch {
    setStatus('Image could not be loaded', 'error')
  } finally {
    URL.revokeObjectURL(objectUrl)
    imageInput.value = ''
  }
})

deleteButton.addEventListener('click', () => {
  customizer.deleteSelected()
})

requiredElement<HTMLButtonElement>('#reset-view-button').addEventListener('click', () => {
  customizer.resetView()
})

requiredElement<HTMLButtonElement>('#export-button').addEventListener('click', () => {
  try {
    customizer.exportTexture()
    setStatus('Texture exported')
  } catch {
    setStatus('Export blocked by remote asset CORS', 'error')
  }
})

requiredElement<HTMLButtonElement>('#remote-button').addEventListener('click', () => {
  dialog.showModal()
})

requiredElement<HTMLButtonElement>('#close-dialog-button').addEventListener('click', () => {
  dialog.close()
})

requiredElement<HTMLButtonElement>('#demo-button').addEventListener('click', async () => {
  loadButton.disabled = true
  setStatus('Loading demo', 'busy')
  try {
    await customizer.loadProduct({})
    dialog.close()
  } finally {
    loadButton.disabled = false
  }
})

remoteForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!remoteForm.reportValidity()) {
    return
  }

  const modelUrl = requiredElement<HTMLInputElement>('#model-url').value
  const textureUrl = requiredElement<HTMLInputElement>('#texture-url').value
  const surfaceMesh = requiredElement<HTMLInputElement>('#mesh-name').value
  const textureFlipY = requiredElement<HTMLInputElement>('#flip-texture').checked

  loadButton.disabled = true
  setStatus('Loading remote product', 'busy')
  try {
    await customizer.loadProduct({
      modelUrl,
      textureUrl,
      surfaceMesh,
      textureFlipY,
    })
    dialog.close()
  } finally {
    loadButton.disabled = false
  }
})

window.addEventListener('beforeunload', () => customizer.destroy(), { once: true })
