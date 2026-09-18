import { createWorkbench } from '../workbench'
import customForgeLogoUrl from '../workbench/assets/CustomForgeLogo.png'
import '../style.css'
import './styles.css'

const workbench = await createWorkbench({
  container: '#app',
})

await workbench.customizer.addImage({
  src: customForgeLogoUrl,
  name: 'CustomForge logo',
  x: 800,
  y: 215,
  width: 200,
})
workbench.customizer.addText({
  text: 'CustomForge',
  x: 690,
  y: 320,
  width: 220,
  color: '#182023',
})
workbench.customizer.clearSelection()
workbench.customizer.clearHistory()
workbench.setStatus('Demo product ready')
