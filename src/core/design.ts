import type {
  DesignImageRole,
  DesignDocument,
  DesignObject,
  DesignObjectState,
  DesignObjectTransform,
  ProductDesignDocument,
} from './types'

/** 当前支持的 Design JSON Schema 版本 */
export const DESIGN_SCHEMA_VERSION = 1

/** 当前支持的多区域产品 Design JSON Schema 版本 */
export const PRODUCT_DESIGN_SCHEMA_VERSION = 2

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

/**
 * 校验并净化外部多区域产品 Design JSON
 *
 * 区域内部对象复用 version 1 单画布解析规则，模型与区域指纹的匹配由产品实例负责
 *
 * @param value JSON.parse 结果或其他未知输入
 * @returns 只包含当前多区域 Schema 字段的新产品设计文档
 * @throws 文档版本、区域字段或嵌套设计对象不符合契约时抛出 TypeError
 */
export function parseProductDesignDocument(
  value: unknown,
): ProductDesignDocument {
  const product = readRecord(value, 'design')
  if (product.version !== PRODUCT_DESIGN_SCHEMA_VERSION) {
    throw new TypeError(
      'design.version must be ' + PRODUCT_DESIGN_SCHEMA_VERSION,
    )
  }
  const modelFingerprint = readString(
    product.modelFingerprint,
    'design.modelFingerprint',
  )
  const processorVersion = readString(
    product.processorVersion,
    'design.processorVersion',
  )
  const activeAreaId = readString(product.activeAreaId, 'design.activeAreaId')
  if (!Array.isArray(product.areas) || product.areas.length === 0) {
    throw new TypeError('design.areas must be a non-empty array')
  }

  const areaIds = new Set<string>()
  const areas = product.areas.map((value, index) => {
    const path = 'design.areas[' + index + ']'
    const area = readRecord(value, path)
    const areaId = readString(area.areaId, path + '.areaId')
    if (areaIds.has(areaId)) {
      throw new TypeError('design area id is duplicated: ' + areaId)
    }
    areaIds.add(areaId)
    const parsed = parseDesignDocument({
      version: DESIGN_SCHEMA_VERSION,
      canvas: area.canvas,
      objects: area.objects,
    })
    return {
      areaId,
      areaFingerprint: readString(
        area.areaFingerprint,
        path + '.areaFingerprint',
      ),
      canvas: parsed.canvas,
      objects: parsed.objects,
    }
  })
  if (!areaIds.has(activeAreaId)) {
    throw new TypeError('design.activeAreaId must reference design.areas')
  }
  return {
    version: PRODUCT_DESIGN_SCHEMA_VERSION,
    modelFingerprint,
    processorVersion,
    activeAreaId,
    areas,
  }
}
