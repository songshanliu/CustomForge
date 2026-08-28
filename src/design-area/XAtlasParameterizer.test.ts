import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three'

const xatlasMocks = vi.hoisted(() => ({
  loadLibrary: vi.fn(),
  unwrapGeometry: vi.fn(),
}))

vi.mock('xatlas-three', () => ({
  UVUnwrapper: class {
    packOptions: Record<string, unknown> = {}
    loadLibrary = xatlasMocks.loadLibrary
    unwrapGeometry = xatlasMocks.unwrapGeometry
  },
}))

import {
  XAtlasInitializationError,
  XAtlasParameterizer,
} from './XAtlasParameterizer'

function createGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ], 3),
  )
  return geometry
}

function createWasmResponse(): Response {
  return new Response(Uint8Array.from([0x00, 0x61, 0x73, 0x6d]))
}

describe('XAtlasParameterizer', () => {
  beforeEach(() => {
    xatlasMocks.loadLibrary.mockReset()
    xatlasMocks.unwrapGeometry.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects an unsuccessful WASM response before creating the Worker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 503 })),
    )

    await expect(
      new XAtlasParameterizer().unwrap(createGeometry(), 1024, 800, 800),
    ).rejects.toThrow(
      'xatlas WASM initialization failed: ' +
        'xatlas WASM request failed with HTTP 503',
    )
    expect(xatlasMocks.loadLibrary).not.toHaveBeenCalled()
  })

  it('rejects a non-WASM response before creating the Worker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>')))

    await expect(
      new XAtlasParameterizer().unwrap(createGeometry(), 1024, 800, 800),
    ).rejects.toThrow(XAtlasInitializationError)
    expect(xatlasMocks.loadLibrary).not.toHaveBeenCalled()
  })

  it('passes a validated WASM Blob to xatlas and revokes it after loading', async () => {
    const result = createGeometry()
    result.setAttribute(
      'uv',
      new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createWasmResponse()))
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:customforge-xatlas')
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    xatlasMocks.loadLibrary.mockResolvedValue(undefined)
    xatlasMocks.unwrapGeometry.mockResolvedValue({
      atlasCount: 1,
      geometries: [result],
      height: 1024,
      width: 1024,
    })

    await expect(
      new XAtlasParameterizer().unwrap(createGeometry(), 1024, 1024, 512),
    ).resolves.toBe(result)
    const uv = result.getAttribute('uv')
    expect([uv.getX(0), uv.getY(0)]).toEqual([0.25, 0])
    expect([uv.getX(1), uv.getY(1)]).toEqual([0.75, 0])
    expect([uv.getX(2), uv.getY(2)]).toEqual([0.25, 1])
    expect(createObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/wasm' }),
    )
    expect(xatlasMocks.loadLibrary.mock.calls[0]?.[1]).toBe(
      'blob:customforge-xatlas',
    )
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:customforge-xatlas')
  })

  it('stops waiting when the xatlas Worker does not initialize', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createWasmResponse()))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:customforge-xatlas-timeout',
    )
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    xatlasMocks.loadLibrary.mockReturnValue(new Promise<void>(() => undefined))

    const operation = new XAtlasParameterizer().unwrap(
      createGeometry(),
      1024,
      800,
      800,
    )
    const rejection = expect(operation).rejects.toThrow(
      'xatlas WASM initialization timed out after 15 seconds',
    )
    await vi.advanceTimersByTimeAsync(15_000)

    await rejection
    expect(revokeObjectUrl).toHaveBeenCalledWith(
      'blob:customforge-xatlas-timeout',
    )
  })
})
