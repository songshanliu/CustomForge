import { CustomForgeWorkbench } from './CustomForgeWorkbench'
import type { WorkbenchOptions } from './types'

/**
 * 创建带默认界面的产品定制工作台
 *
 * 使用 `features` 控制具体功能控件，使用 `layout` 控制顶部栏、工具栏、图层面板等区域
 * 不再使用返回的实例时必须调用 `destroy()`
 *
 * @param options 挂载容器、产品资源、功能和布局开关
 * @returns 初始化完成的 Workbench
 * @throws 挂载容器无效、模型加载失败或目标 Mesh 不存在时抛出错误
 *
 * @example
 * ```ts
 * const workbench = await createWorkbench({
 *   container: '#app',
 *   features: { addText: false },
 *   layout: { header: false },
 * })
 * ```
 */
export async function createWorkbench(
  options: WorkbenchOptions,
): Promise<CustomForgeWorkbench> {
  return CustomForgeWorkbench.create(options)
}

export { CustomForgeWorkbench }
export type {
  WorkbenchAsset,
  WorkbenchAssetLibrary,
  WorkbenchBranding,
  WorkbenchFeatureName,
  WorkbenchFeatures,
  WorkbenchIconConfiguration,
  WorkbenchIconName,
  WorkbenchLabels,
  WorkbenchLayout,
  WorkbenchLayoutName,
  WorkbenchOptions,
  WorkbenchStatusMode,
  WorkbenchTextPreset,
  WorkbenchTheme,
} from './types'
