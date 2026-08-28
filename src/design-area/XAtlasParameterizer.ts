import { BufferAttribute, type BufferGeometry } from 'three'
import { UVUnwrapper } from 'xatlas-three'
import xatlasWorkerUrl from 'xatlasjs/dist/xatlas.js?url'
import xatlasWasmUrl from 'xatlasjs/dist/xatlas.wasm?url'

const XATLAS_INITIALIZATION_TIMEOUT_MS = 15_000
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasWasmMagic(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < WASM_MAGIC.length) {
    return false
  }
  const header = new Uint8Array(bytes, 0, WASM_MAGIC.length)
  return WASM_MAGIC.every((value, index) => header[index] === value)
}

/** xatlas 初始化和单区域展开期间报告的进度 */
export interface XAtlasProgress {
  /** xatlas 当前处理模式 */
  mode: string

  /** 当前模式完成比例，范围为 0-1 */
  progress: number
}

/** xatlas Worker 或 WASM 资源无法完成初始化时抛出的致命错误 */
export class XAtlasInitializationError extends Error {
  /**
   * @param message 可直接显示给调用方的初始化失败原因
   * @param cause 浏览器或底层依赖返回的原始错误
   */
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'XAtlasInitializationError'
  }
}

/**
 * 在 xatlas 自带 Worker 中为候选表面生成不重叠的 0-1 UV
 *
 * 实例会复用已经加载的 WASM 模块，调用方应在产品查看器生命周期内复用
 */
export class XAtlasParameterizer {
  private unwrapper = this.createUnwrapper()
  private libraryPromise?: Promise<void>
  private progressListener?: (progress: XAtlasProgress) => void
  private operationQueue = Promise.resolve()

  /**
   * 展开一块独立候选几何体
   *
   * xatlas 可能重建索引和顶点属性，调用方不能把传入几何体视为不可变对象
   *
   * @param geometry 只包含当前候选区域的独立索引几何体
   * @param textureSize 纹理图集边长，单位为像素
   * @param targetWidth 最终编辑画布宽度，单位为像素
   * @param targetHeight 最终编辑画布高度，单位为像素
   * @param onProgress 可选的 WASM 加载与展开进度监听器
   * @returns 已写入 uv Attribute 的同一几何体
   * @throws xatlas 资源加载、参数化或 UV 质量校验失败时抛出错误
   */
  async unwrap(
    geometry: BufferGeometry,
    textureSize: number,
    targetWidth: number,
    targetHeight: number,
    onProgress?: (progress: XAtlasProgress) => void,
  ): Promise<BufferGeometry> {
    const previousOperation = this.operationQueue
    let releaseOperation = (): void => undefined
    this.operationQueue = new Promise<void>((resolve) => {
      releaseOperation = resolve
    })
    await previousOperation

    try {
      this.progressListener = onProgress
      this.unwrapper.packOptions.resolution = textureSize
      this.unwrapper.packOptions.padding = Math.max(
        2,
        Math.round(textureSize * 0.006),
      )
      await this.loadLibrary()
      const atlas = await this.unwrapper.unwrapGeometry(geometry, 'uv', 'uv2')
      if (atlas.atlasCount !== 1) {
        throw new Error('xatlas generated more than one texture atlas')
      }
      const result = atlas.geometries[0]
      if (!result) {
        throw new Error('xatlas did not return parameterized geometry')
      }
      const uv = result.getAttribute('uv')
      if (!uv || uv.itemSize !== 2 || uv.count === 0) {
        throw new Error('xatlas did not generate valid UV coordinates')
      }
      if (result.getAttribute('position').count > 65_535) {
        throw new Error('xatlas generated more than 65535 overlay vertices')
      }
      if (
        ![atlas.width, atlas.height, targetWidth, targetHeight].every(
          (value) => Number.isFinite(value) && value > 0,
        )
      ) {
        throw new Error('xatlas returned invalid atlas dimensions')
      }
      const scale = Math.min(
        targetWidth / atlas.width,
        targetHeight / atlas.height,
      )
      const offsetX = (targetWidth - atlas.width * scale) / 2
      const offsetY = (targetHeight - atlas.height * scale) / 2
      for (let index = 0; index < uv.count; index += 1) {
        const u = (
          uv.getX(index) * atlas.width * scale + offsetX
        ) / targetWidth
        const v = (
          uv.getY(index) * atlas.height * scale + offsetY
        ) / targetHeight
        if (
          ![u, v].every(Number.isFinite) ||
          u < -1e-6 ||
          u > 1 + 1e-6 ||
          v < -1e-6 ||
          v > 1 + 1e-6
        ) {
          throw new Error('xatlas generated UV coordinates outside the canvas')
        }
        uv.setXY(
          index,
          Math.min(Math.max(u, 0), 1),
          Math.min(Math.max(v, 0), 1),
        )
      }
      uv.needsUpdate = true
      result.computeBoundingBox()
      result.computeBoundingSphere()
      return result
    } catch (error) {
      this.unwrapper = this.createUnwrapper()
      this.libraryPromise = undefined
      throw error
    } finally {
      this.progressListener = undefined
      releaseOperation()
    }
  }

  private createUnwrapper(): UVUnwrapper {
    return new UVUnwrapper(
      { BufferAttribute },
      {
        resolution: 1024,
        padding: 4,
        bilinear: true,
        rotateCharts: true,
        rotateChartsToAxis: true,
      },
      {
        fixWinding: false,
        maxIterations: 4,
        useInputMeshUvs: false,
      },
      true,
    )
  }

  private loadLibrary(): Promise<void> {
    this.libraryPromise ??= this.initializeLibrary()
    return this.libraryPromise
  }

  private async initializeLibrary(): Promise<void> {
    const abortController = new AbortController()
    let objectUrl: string | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timedOut = false

    const initialization = (async (): Promise<void> => {
      const response = await fetch(xatlasWasmUrl, {
        credentials: 'same-origin',
        signal: abortController.signal,
      })
      if (!response.ok) {
        throw new Error(
          'xatlas WASM request failed with HTTP ' + response.status,
        )
      }
      const bytes = await response.arrayBuffer()
      if (!hasWasmMagic(bytes)) {
        throw new Error('xatlas WASM response is not a WebAssembly module')
      }

      objectUrl = URL.createObjectURL(
        new Blob([bytes], { type: 'application/wasm' }),
      )
      await this.unwrapper.loadLibrary(
        (mode, progress) => {
          const numeric = typeof progress === 'number' ? progress : 0
          this.progressListener?.({
            mode: String(mode),
            progress: Math.min(
              Math.max(numeric > 1 ? numeric / 100 : numeric, 0),
              1,
            ),
          })
        },
        objectUrl,
        xatlasWorkerUrl,
      )
    })()

    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true
        abortController.abort()
        reject(
          new XAtlasInitializationError(
            'xatlas WASM initialization timed out after 15 seconds',
          ),
        )
      }, XATLAS_INITIALIZATION_TIMEOUT_MS)
    })

    try {
      await Promise.race([initialization, timeout])
    } catch (error) {
      if (error instanceof XAtlasInitializationError) {
        throw error
      }
      if (timedOut) {
        throw new XAtlasInitializationError(
          'xatlas WASM initialization timed out after 15 seconds',
          error,
        )
      }
      throw new XAtlasInitializationError(
        'xatlas WASM initialization failed: ' + errorMessage(error),
        error,
      )
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      abortController.abort()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }
}
