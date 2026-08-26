import { describe, expect, it } from 'vitest'
import { parseDesignDocument } from './design'

const validDesign = {
  version: 1,
  canvas: { width: 1024, height: 512 },
  objects: [
    {
      id: 'object-1',
      type: 'text',
      transform: {
        x: 300,
        y: 200,
        scaleX: 1,
        scaleY: 1,
        rotation: 12,
        flipX: false,
        flipY: false,
      },
      text: 'CustomForge',
      width: 420,
      fontFamily: 'Arial',
      fontSize: 64,
      color: '#172126',
    },
  ],
}

describe('parseDesignDocument', () => {
  it('returns a sanitized version 1 document', () => {
    expect(parseDesignDocument({ ...validDesign, ignored: true })).toEqual(validDesign)
  })

  it('rejects unsupported schema versions', () => {
    expect(() => parseDesignDocument({ ...validDesign, version: 2 })).toThrow(
      'design.version must be 1',
    )
  })

  it('rejects duplicate object ids', () => {
    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [validDesign.objects[0], validDesign.objects[0]],
      }),
    ).toThrow('design object id is duplicated: object-1')
  })

  it('rejects non-persistent image sources', () => {
    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [
          {
            id: 'object-2',
            type: 'image',
            transform: validDesign.objects[0].transform,
            src: 'blob:https://example.com/session-only',
          },
        ],
      }),
    ).toThrow('design.objects[0].src must not use a Blob URL')
  })

  it('rejects non-positive transform scales', () => {
    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [
          {
            ...validDesign.objects[0],
            transform: { ...validDesign.objects[0].transform, scaleX: 0 },
          },
        ],
      }),
    ).toThrow('design.objects[0].transform.scaleX must be greater than zero')
  })
})
