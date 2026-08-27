import { createWorkbench } from '../workbench'
import '../style.css'
import './styles.css'

const workbench = await createWorkbench({
  container: '#app',
})

workbench.customizer.addText({
  text: 'CF',
  x: 680,
  y: 170,
  width: 220,
  fontSize: 132,
  color: '#df5144',
})
workbench.customizer.addText({
  text: 'MAKE IT YOURS',
  x: 96,
  y: 206,
  width: 430,
  fontSize: 66,
  color: '#182023',
})
workbench.setStatus('Demo product ready')
