import { createCustomizer } from 'customforge'
import 'customforge/style.css'
import './styles.css'

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Required element was not found: ${selector}`)
  }
  return element
}

const status = requiredElement<HTMLSpanElement>('#status')
const controls = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
const designInput = requiredElement<HTMLInputElement>('#design-input')
const loadDesignButton = requiredElement<HTMLButtonElement>('#load-design')
const customizer = await createCustomizer({
  editor: '#editor',
  viewer: '#viewer',
})

customizer.on('change', ({ objectCount }) => {
  status.textContent = `${objectCount} editable object${objectCount === 1 ? '' : 's'}`
})
customizer.on('status', ({ message }) => {
  status.textContent = message
})
customizer.on('error', ({ error }) => {
  status.textContent = error.message
})

customizer.addText({
  text: 'LOCAL PACKAGE',
  x: 80,
  y: 190,
  width: 500,
  fontSize: 68,
  color: '#172126',
})

const imageSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <rect width="240" height="240" rx="28" fill="#d9483b"/>
    <path d="M62 68h116v28H96v48h72v28H96v40H62z" fill="#fff"/>
  </svg>
`)}`

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = filename
  anchor.href = url
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

requiredElement<HTMLButtonElement>('#add-text').addEventListener('click', () => {
  customizer.addText()
})

requiredElement<HTMLButtonElement>('#add-image').addEventListener('click', async () => {
  await customizer.addImage({ src: imageSource, x: 760, y: 250, width: 190 })
})

requiredElement<HTMLButtonElement>('#save-design').addEventListener('click', () => {
  try {
    downloadJson('customforge-consumer-design.json', customizer.saveDesign())
    status.textContent = 'Design saved'
  } catch (error) {
    status.textContent = errorMessage(error)
  }
})

loadDesignButton.addEventListener('click', () => {
  designInput.click()
})

designInput.addEventListener('change', async () => {
  const file = designInput.files?.[0]
  if (!file) {
    return
  }

  loadDesignButton.disabled = true
  status.textContent = 'Loading design'
  try {
    await customizer.loadDesign(JSON.parse(await file.text()))
    status.textContent = 'Design loaded'
  } catch (error) {
    status.textContent = errorMessage(error)
  } finally {
    loadDesignButton.disabled = false
    designInput.value = ''
  }
})

requiredElement<HTMLButtonElement>('#reset-view').addEventListener('click', () => {
  customizer.resetView()
})

requiredElement<HTMLButtonElement>('#export').addEventListener('click', () => {
  customizer.exportTexture('customforge-consumer-texture.png')
})

requiredElement<HTMLFormElement>('#remote-product').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault()
    status.textContent = 'Loading remote product'

    try {
      await customizer.loadProduct({
        modelUrl: requiredElement<HTMLInputElement>('#model-url').value,
        surfaceMesh: requiredElement<HTMLInputElement>('#mesh-name').value,
        textureFlipY: requiredElement<HTMLInputElement>('#flip-texture').checked,
      })
    } catch {
      // The public error event updates the status with the original message.
    }
  },
)

requiredElement<HTMLButtonElement>('#use-demo').addEventListener('click', async () => {
  await customizer.loadProduct({})
})

requiredElement<HTMLButtonElement>('#destroy').addEventListener('click', () => {
  customizer.destroy()
  controls.forEach((control) => {
    control.disabled = true
  })
  status.textContent = 'Destroyed'
})

window.addEventListener('beforeunload', () => customizer.destroy(), { once: true })
