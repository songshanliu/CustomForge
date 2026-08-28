import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SurfaceAnalysisCancelledError,
  SurfaceAnalysisCoordinator,
} from './SurfaceAnalysisCoordinator'
import type { SurfaceGeometrySnapshot } from './types'

const snapshot: SurfaceGeometrySnapshot = {
  meshId: 'mesh-0',
  positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  indices: Uint32Array.from([0, 1, 2]),
  materialIndices: Int32Array.from([0]),
}

const options = {
  maxAreas: 1,
  adjacentAngleDegrees: 35,
  normalDeviationDegrees: 50,
  minimumAreaRatio: 0.001,
}

afterEach(() => vi.unstubAllGlobals())

describe('SurfaceAnalysisCoordinator', () => {
  it('rejects the active promise when analysis is cancelled', async () => {
    class PendingWorker {
      addEventListener(): void {}
      postMessage(): void {}
      terminate(): void {}
    }
    vi.stubGlobal('Worker', PendingWorker)
    const coordinator = new SurfaceAnalysisCoordinator()

    const pending = coordinator.analyze([snapshot], options)
    coordinator.cancel()

    await expect(pending).rejects.toBeInstanceOf(
      SurfaceAnalysisCancelledError,
    )
  })

  it('uses the deterministic implementation when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)
    const coordinator = new SurfaceAnalysisCoordinator()

    const result = await coordinator.analyze([snapshot], options)

    expect(result.candidates).toHaveLength(1)
  })
})
