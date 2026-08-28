import { analyzeSurfaceSnapshots } from './surfaceAnalysis'
import type {
  SurfaceAnalysisOptions,
  SurfaceAnalysisProgress,
  SurfaceAnalysisResult,
  SurfaceGeometrySnapshot,
} from './types'

interface WorkerSuccessMessage {
  id: number
  result: SurfaceAnalysisResult
  type: 'success'
}

interface WorkerErrorMessage {
  id: number
  message: string
  type: 'error'
}

interface WorkerProgressMessage {
  id: number
  progress: SurfaceAnalysisProgress
  type: 'progress'
}

type WorkerResponse = WorkerSuccessMessage | WorkerErrorMessage | WorkerProgressMessage

interface ActiveRequest {
  id: number
  reject: (reason: Error) => void
  worker: Worker
}

/** 表面分析任务被更换产品、显式取消或实例销毁时抛出的错误 */
export class SurfaceAnalysisCancelledError extends Error {
  /** 创建可被调用方识别的分析取消错误 */
  constructor() {
    super('Surface analysis was cancelled')
    this.name = 'SurfaceAnalysisCancelledError'
  }
}

/** 在 Worker 中调度表面分析并管理取消和过期结果 */
export class SurfaceAnalysisCoordinator {
  private activeRequest?: ActiveRequest
  private requestSequence = 0

  /**
   * 分析静态 Mesh 快照
   *
   * Worker 不可用时会在当前线程执行相同的确定性实现
   *
   * @param snapshots 不与渲染 Buffer 共享内存的几何快照
   * @param options 分区和候选数量配置
   * @param onProgress 可选进度监听器
   * @returns 自动表面候选和整体统计
   * @throws Worker 执行失败或任务被后续分析取消时抛出错误
   */
  analyze(
    snapshots: SurfaceGeometrySnapshot[],
    options: SurfaceAnalysisOptions,
    onProgress?: (progress: SurfaceAnalysisProgress) => void,
  ): Promise<SurfaceAnalysisResult> {
    this.cancel()
    const requestId = ++this.requestSequence
    if (typeof Worker === 'undefined') {
      return Promise.resolve().then(() => {
        if (requestId !== this.requestSequence) {
          throw new SurfaceAnalysisCancelledError()
        }
        const result = analyzeSurfaceSnapshots(
          snapshots,
          options,
          (progress) => {
            if (requestId === this.requestSequence) {
              onProgress?.(progress)
            }
          },
        )
        if (requestId !== this.requestSequence) {
          throw new SurfaceAnalysisCancelledError()
        }
        return result
      })
    }

    const worker = new Worker(
      new URL('./worker/surfaceAnalysis.worker.ts', import.meta.url),
      { type: 'module' },
    )
    return new Promise((resolve, reject) => {
      this.activeRequest = { id: requestId, reject, worker }
      worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== requestId) {
          return
        }
        if (event.data.type === 'progress') {
          onProgress?.(event.data.progress)
          return
        }
        this.activeRequest = undefined
        worker.terminate()
        if (event.data.type === 'error') {
          reject(new Error(event.data.message))
        } else {
          resolve(event.data.result)
        }
      })
      worker.addEventListener('error', (event) => {
        if (this.activeRequest?.id !== requestId) {
          return
        }
        this.activeRequest = undefined
        worker.terminate()
        reject(new Error(event.message || 'Surface analysis worker failed'))
      }, { once: true })
      const transfer: Transferable[] = snapshots.flatMap((snapshot) => [
        snapshot.positions.buffer,
        ...(snapshot.normals ? [snapshot.normals.buffer] : []),
        snapshot.indices.buffer,
        snapshot.materialIndices.buffer,
      ]).map((buffer) => buffer as ArrayBuffer)
      try {
        worker.postMessage({ id: requestId, options, snapshots }, transfer)
      } catch (error) {
        this.activeRequest = undefined
        worker.terminate()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /** 取消当前分析任务，已返回的 Promise 将不再产生有效结果 */
  cancel(): void {
    this.requestSequence += 1
    const request = this.activeRequest
    this.activeRequest = undefined
    if (request) {
      request.worker.terminate()
      request.reject(new SurfaceAnalysisCancelledError())
    }
  }

  /** 取消任务并释放 Worker */
  destroy(): void {
    this.cancel()
  }
}
