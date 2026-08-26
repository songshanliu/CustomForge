import type {
  DesignDocument,
  DesignObject,
  DesignObjectTransform,
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

  if (object.type === 'text') {
    return {
      id,
      type: 'text',
      transform,
      text: readString(object.text, `${path}.text`, true),
      width: readPositiveNumber(object.width, `${path}.width`),
      fontFamily: readString(object.fontFamily, `${path}.fontFamily`),
      fontSize: readPositiveNumber(object.fontSize, `${path}.fontSize`),
      color: readString(object.color, `${path}.color`),
    }
  }

  if (object.type === 'image') {
    const src = readString(object.src, `${path}.src`)
    if (src.startsWith('blob:')) {
      throw new TypeError(`${path}.src must not use a Blob URL`)
    }
    return { id, type: 'image', transform, src }
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
  for (const object of objects) {
    if (ids.has(object.id)) {
      throw new TypeError(`design object id is duplicated: ${object.id}`)
    }
    ids.add(object.id)
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
