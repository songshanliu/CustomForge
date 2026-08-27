import type { DesignDocument } from 'customforge'
import { createWorkbench } from 'customforge/workbench'
import 'customforge/style.css'
import './styles.css'

function svgDataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
}

const background = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">
    <rect width="1024" height="512" fill="#f0f4f8"/>
    <path d="M0 390C180 280 330 470 512 360s330 80 512-30v182H0z" fill="#bed7ee"/>
  </svg>
`)

const element = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <rect width="240" height="240" rx="24" fill="#17191c"/>
    <path d="M62 68h116v28H96v48h72v28H96v40H62z" fill="#ffffff"/>
  </svg>
`)

const workbench = await createWorkbench({
  container: '#workbench',
  branding: {
    title: 'Package consumer',
    subtitle: 'Installed from a local npm artifact',
  },
  labels: {
    editorTitle: 'Package design surface',
    viewerTitle: 'Packaged 3D preview',
  },
  theme: {
    accent: '#155eef',
    accentHover: '#004eeb',
  },
  assets: {
    backgrounds: [
      { id: 'consumer-background', name: 'Blue wave', url: background },
    ],
    elements: [
      { id: 'consumer-mark', name: 'Consumer mark', url: element },
    ],
  },
})

workbench.customizer.addText({
  text: 'LOCAL PACKAGE',
  name: 'Package label',
  x: 80,
  y: 190,
  width: 500,
  fontSize: 68,
  color: '#17191c',
})

const initialDesign: DesignDocument = workbench.customizer.saveDesign()
workbench.setStatus(`${initialDesign.objects.length} packaged object`)

window.addEventListener('beforeunload', () => workbench.destroy(), {
  once: true,
})
