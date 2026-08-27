import type { WorkbenchAssetLibrary } from '../types'
import customForgeLogoUrl from './CustomForgeLogo.png'

/**
 * Workbench 随包提供的图片素材目录
 *
 * 新素材文件应分别放入 backgrounds 或 elements 目录，并在此处使用 import 后注册
 */
export const builtInAssetLibrary: Required<WorkbenchAssetLibrary> = {
  backgrounds: [],
  elements: [
    {
      id: 'customforge-logo',
      name: 'CustomForge logo',
      url: customForgeLogoUrl,
      alt: 'CustomForge logo',
    },
  ],
}
