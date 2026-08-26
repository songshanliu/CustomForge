function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Blob image could not be converted to a Data URL'))
      }
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Blob image could not be read'))
    })
    reader.readAsDataURL(blob)
  })
}

/**
 * 将短生命周期 Blob URL 转换为可写入 Design JSON 的 Data URL
 *
 * 远程 URL 和已有 Data URL 会保持不变
 *
 * @param src 图片来源
 * @returns 可跨页面会话重新加载的图片来源
 * @throws Blob URL 已失效或浏览器无法读取对应 Blob 时抛出错误
 */
export async function resolvePersistentImageSource(src: string): Promise<string> {
  if (!src.startsWith('blob:')) {
    return src
  }

  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Blob image could not be loaded: ${response.status}`)
  }
  return readBlobAsDataUrl(await response.blob())
}
