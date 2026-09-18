import type {
  DesignImageRole,
  DesignDocument,
  DesignObject,
  DesignObjectState,
  DesignObjectTransform,
  TextAlignment,
  TextFontStyle,
  TextFontWeight,
} from './types'

/** 当前支持的 Design JSON Schema 版本 */
export const DESIGN_SCHEMA_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value
}

function readString(
  value: unknown,
  path: string,
  allowEmpty = false,
): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new TypeError(`${path} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`)
  }
  return value
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number`)
  }
  return value
}

function readPositiveNumber(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path)
  if (number <= 0) {
    throw new TypeError(`${path} must be greater than zero`)
  }
  return number
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean`)
  }
  return value
}

function readImageRole(value: unknown, path: string): DesignImageRole {
  if (value !== 'element' && value !== 'background') {
    throw new TypeError(`${path} must be element or background`)
  }
  return value
}

function readTextAlignment(value: unknown, path: string): TextAlignment {
  if (value !== 'left' && value !== 'center' && value !== 'right') {
    throw new TypeError(`${path} must be left, center, or right`)
  }
  return value
}

function readTextFontStyle(value: unknown, path: string): TextFontStyle {
  if (value !== 'normal' && value !== 'italic') {
    throw new TypeError(`${path} must be normal or italic`)
  }
  return value
}

function readTextFontWeight(value: unknown, path: string): TextFontWeight {
  if (value === 'normal' || value === 'bold') {
    return value
  }
  const weight = readFiniteNumber(value, path)
  if (weight <= 0 || weight > 1000) {
    throw new TypeError(`${path} must be between 1 and 1000`)
  }
  return weight
}

function parseObjectState(
  object: Record<string, unknown>,
  path: string,
): DesignObjectState {
  return {
    ...(object.name === undefined
      ? {}
      : { name: readString(object.name, `${path}.name`).trim() }),
    visible:
      object.visible === undefined
        ? true
        : readBoolean(object.visible, `${path}.visible`),
    locked:
      object.locked === undefined
        ? false
        : readBoolean(object.locked, `${path}.locked`),
  }
}

function parseTransform(value: unknown, path: string): DesignObjectTransform {
  const transform = readRecord(value, path)
  return {
    x: readFiniteNumber(transform.x, `${path}.x`),
    y: readFiniteNumber(transform.y, `${path}.y`),
    scaleX: readPositiveNumber(transform.scaleX, `${path}.scaleX`),
    scaleY: readPositiveNumber(transform.scaleY, `${path}.scaleY`),
    rotation: readFiniteNumber(transform.rotation, `${path}.rotation`),
    flipX: readBoolean(transform.flipX, `${path}.flipX`),
    flipY: readBoolean(transform.flipY, `${path}.flipY`),
  }
}

function parseObject(value: unknown, index: number): DesignObject {
  const path = `design.objects[${index}]`
  const object = readRecord(value, path)
  const id = readString(object.id, `${path}.id`)
  const transform = parseTransform(object.transform, `${path}.transform`)
  const state = parseObjectState(object, path)

  if (object.type === 'text') {
    return {
      id,
      type: 'text',
      ...state,
      transform,
      text: readString(object.text, `${path}.text`, true),
      width: readPositiveNumber(object.width, `${path}.width`),
      fontFamily: readString(object.fontFamily, `${path}.fontFamily`),
      fontSize: readPositiveNumber(object.fontSize, `${path}.fontSize`),
      color: readString(object.color, `${path}.color`),
      ...(object.fontWeight === undefined
        ? {}
        : {
            fontWeight: readTextFontWeight(
              object.fontWeight,
              `${path}.fontWeight`,
            ),
          }),
      ...(object.fontStyle === undefined
        ? {}
        : {
            fontStyle: readTextFontStyle(
              object.fontStyle,
              `${path}.fontStyle`,
            ),
          }),
      ...(object.underline === undefined
        ? {}
        : { underline: readBoolean(object.underline, `${path}.underline`) }),
      ...(object.textAlign === undefined
        ? {}
        : {
            textAlign: readTextAlignment(
              object.textAlign,
              `${path}.textAlign`,
            ),
          }),
      ...(object.lineHeight === undefined
        ? {}
        : {
            lineHeight: readPositiveNumber(
              object.lineHeight,
              `${path}.lineHeight`,
            ),
          }),
      ...(object.charSpacing === undefined
        ? {}
        : {
            charSpacing: readFiniteNumber(
              object.charSpacing,
              `${path}.charSpacing`,
            ),
          }),
      ...(object.backgroundColor === undefined
        ? {}
        : {
            backgroundColor: readString(
              object.backgroundColor,
              `${path}.backgroundColor`,
            ),
          }),
    }
  }

  if (object.type === 'image') {
    const src = readString(object.src, `${path}.src`)
    if (src.startsWith('blob:')) {
      throw new TypeError(`${path}.src must not use a Blob URL`)
    }
    return {
      id,
      type: 'image',
      ...state,
      transform,
      src,
      ...(object.role === undefined
        ? {}
        : { role: readImageRole(object.role, `${path}.role`) }),
    }
  }

  throw new TypeError(`${path}.type is not supported`)
}

/**
 * 校验并净化外部 Design JSON
 *
 * @param value JSON.parse 结果或其他未知输入
 * @returns 只包含当前 Schema 字段的新设计文档
 * @throws 文档版本、字段类型、对象 ID 或图片来源不符合契约时抛出 TypeError
 */
export function parseDesignDocument(value: unknown): DesignDocument {
  const design = readRecord(value, 'design')
  if (design.version !== DESIGN_SCHEMA_VERSION) {
    throw new TypeError(`design.version must be ${DESIGN_SCHEMA_VERSION}`)
  }

  const canvas = readRecord(design.canvas, 'design.canvas')
  if (!Array.isArray(design.objects)) {
    throw new TypeError('design.objects must be an array')
  }

  const objects = design.objects.map(parseObject)
  const ids = new Set<string>()
  let backgroundCount = 0
  for (const object of objects) {
    if (ids.has(object.id)) {
      throw new TypeError(`design object id is duplicated: ${object.id}`)
    }
    ids.add(object.id)
    if (object.type === 'image' && object.role === 'background') {
      backgroundCount += 1
      if (backgroundCount > 1) {
        throw new TypeError('design must not contain more than one background')
      }
      if (objects.indexOf(object) !== 0) {
        throw new TypeError('design background must be the first object')
      }
    }
  }

  return {
    version: DESIGN_SCHEMA_VERSION,
    canvas: {
      width: readPositiveNumber(canvas.width, 'design.canvas.width'),
      height: readPositiveNumber(canvas.height, 'design.canvas.height'),
    },
    objects,
  }
}
