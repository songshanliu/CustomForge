import type { ElementTarget } from './types'

/**
 * 将 HTMLElement 或 CSS 选择器解析为挂载容器
 *
 * @param target DOM 元素或 CSS 选择器
 * @param label 错误消息中使用的容器名称
 * @returns 解析得到的 DOM 元素
 * @throws CSS 选择器无法找到对应元素时抛出错误
 */
export function resolveElement(target: ElementTarget, label: string): HTMLElement {
  if (target instanceof HTMLElement) {
    return target
  }

  const element = document.querySelector<HTMLElement>(target)
  if (!element) {
    throw new Error(`${label} element was not found: ${target}`)
  }

  return element
}
