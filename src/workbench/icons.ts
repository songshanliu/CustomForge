import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FolderOpen,
  Image as ImageIcon,
  ImagePlus,
  Highlighter,
  Italic,
  Layers3,
  Link2,
  Lock,
  LockOpen,
  Redo2,
  Rows3,
  RotateCcw,
  Save,
  StretchHorizontal,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  Underline,
  Upload,
  X,
  Palette,
  createIcons,
} from 'lucide'
import type {
  WorkbenchIconConfiguration,
  WorkbenchIconName,
} from './types'

/** 渲染 Workbench 内置图标并应用调用方覆盖 */
export function renderWorkbenchIcons(
  root: HTMLElement,
  configuration: Required<WorkbenchIconConfiguration>,
): void {
  root.dataset.icons = configuration.enabled ? 'visible' : 'hidden'
  createIcons({
    nameAttr: 'data-customforge-icon',
    icons: {
      AlignCenter,
      AlignLeft,
      AlignRight,
      ArrowDown,
      ArrowUp,
      Bold,
      Download,
      Ellipsis,
      Eye,
      EyeOff,
      FolderOpen,
      Image: ImageIcon,
      ImagePlus,
      Highlighter,
      Italic,
      Layers3,
      Link2,
      Lock,
      LockOpen,
      Palette,
      Redo2,
      Rows3,
      RotateCcw,
      Save,
      StretchHorizontal,
      TextCursorInput,
      Trash2,
      Type,
      Undo2,
      Underline,
      Upload,
      X,
    },
    attrs: {
      width: 18,
      height: 18,
      'stroke-width': 1.8,
      'aria-hidden': 'true',
    },
  })

  root.querySelectorAll<HTMLElement>('[data-icon-slot]').forEach((element) => {
    const name = element.dataset.iconSlot as WorkbenchIconName
    const source = configuration.sources[name]
    const control = element.closest<HTMLButtonElement>('button')
    if (!configuration.enabled || source === null) {
      element.hidden = true
      if (source === null) {
        control?.classList.add('customforge-workbench__icon-missing')
      }
      return
    }
    control?.classList.remove('customforge-workbench__icon-missing')
    if (!source) {
      element.hidden = false
      return
    }

    if (
      element instanceof HTMLImageElement &&
      element.getAttribute('src') === source
    ) {
      element.hidden = false
      return
    }
    const image = document.createElement('img')
    image.className = 'customforge-workbench__custom-icon'
    image.dataset.iconSlot = name
    image.src = source
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    element.replaceWith(image)
  })
}
