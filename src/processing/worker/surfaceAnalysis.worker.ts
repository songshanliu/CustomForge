/// <reference lib="webworker" />

import { analyzeSurfaceSnapshots } from '../surfaceAnalysis'
import type {
  SurfaceAnalysisOptions,
  SurfaceGeometrySnapshot,
} from '../types'

interface WorkerRequest {
  id: number
  options: SurfaceAnalysisOptions
  snapshots: SurfaceGeometrySnapshot[]
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, options, snapshots } = event.data
  try {
    const result = analyzeSurfaceSnapshots(
      snapshots,
      options,
      (progress) => self.postMessage({ id, progress, type: 'progress' }),
    )
    const transfer: Transferable[] = result.candidates.map(
      (candidate) => candidate.triangleIndices.buffer as ArrayBuffer,
    )
    self.postMessage({ id, result, type: 'success' }, transfer)
  } catch (error) {
    self.postMessage({
      id,
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
    })
  }
})
