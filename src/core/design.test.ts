import { describe, expect, it } from 'vitest'
import { parseDesignDocument } from './design'

const validDesign = {
  version: 1,
  canvas: { width: 1024, height: 512 },
  objects: [
    {
      id: 'object-1',
      type: 'text',
      visible: true,
      locked: false,
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

  it('uses visible and unlocked defaults for legacy version 1 objects', () => {
    const legacyObject = { ...validDesign.objects[0] }
    delete (legacyObject as { visible?: boolean }).visible
    delete (legacyObject as { locked?: boolean }).locked

    expect(
      parseDesignDocument({ ...validDesign, objects: [legacyObject] }).objects[0],
    ).toMatchObject({ visible: true, locked: false })
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

  it('validates optional layer state', () => {
    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [{ ...validDesign.objects[0], visible: 'yes' }],
      }),
    ).toThrow('design.objects[0].visible must be a boolean')
  })

  it('accepts a single bottom design background', () => {
    const background = {
      id: 'background-1',
      type: 'image',
      role: 'background',
      transform: validDesign.objects[0].transform,
      src: 'https://example.com/background.png',
    }

    expect(
      parseDesignDocument({
        ...validDesign,
        objects: [background, validDesign.objects[0]],
      }).objects[0],
    ).toMatchObject({ id: 'background-1', role: 'background' })
  })

  it('rejects a design background above another object', () => {
    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [
          validDesign.objects[0],
          {
            id: 'background-1',
            type: 'image',
            role: 'background',
            transform: validDesign.objects[0].transform,
            src: 'https://example.com/background.png',
          },
        ],
      }),
    ).toThrow('design background must be the first object')
  })

  it('rejects multiple design backgrounds', () => {
    const background = {
      id: 'background-1',
      type: 'image',
      role: 'background',
      transform: validDesign.objects[0].transform,
      src: 'https://example.com/background.png',
    }

    expect(() =>
      parseDesignDocument({
        ...validDesign,
        objects: [
          background,
          {
            ...background,
            id: 'background-2',
            src: 'https://example.com/background-2.png',
          },
        ],
      }),
    ).toThrow('design must not contain more than one background')
  })
})
