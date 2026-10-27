function encodeGlb(document: object, binary: Uint8Array) {
  const json = new TextEncoder().encode(JSON.stringify(document))
  const jsonLength = (json.length + 3) & ~3
  const binaryLength = (binary.length + 3) & ~3
  const bytes = new Uint8Array(28 + jsonLength + binaryLength)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, bytes.length, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.fill(0x20, 20, 20 + jsonLength)
  bytes.set(json, 20)
  view.setUint32(20 + jsonLength, binaryLength, true)
  view.setUint32(24 + jsonLength, 0x004e4942, true)
  bytes.set(binary, 28 + jsonLength)
  return bytes
}

/**
 * 创建小型多 UV 通道 GLB，供独立消费者验证越界映射和元数据，不包含第三方资产
 *
 * @param standard 是否让 UV0 使用标准域，并将元数据策略设为 original
 * @param missingUv 是否省略 UV 属性以验证加载失败事务
 * @param canvas 节点声明的尺寸，可传入非法尺寸以验证分配前校验
 * @param includeMetadata 是否导出节点元数据，用于验证缺失与关闭读取的兼容路径
 * @param mappedBase 是否增加 UV1 与 KHR_texture_transform 驱动的 PBR 底材贴图
 * @param splitIslands 是否拆成两个独立 UV 岛和两个分离平面，用于验证岛间留白
 * @returns 临时模型地址和释放函数，调用方须在测试结束后释放
 */
export function createPrintMappingFixture(standard = false, missingUv = false, canvas = { width: 256, height: 128 }, includeMetadata = true, mappedBase = false, splitIslands = false) {
  const positions = new Float32Array(splitIslands ? [-1, -1, 0, -0.2, -1, 0, -0.2, 1, 0, -1, 1, 0, 0.2, -1, 0, 1, -1, 0, 1, 1, 0, 0.2, 1, 0] : [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0])
  const normals = new Float32Array(positions.length)
  for (let index = 2; index < normals.length; index += 3) normals[index] = 1
  const uv = new Float32Array(splitIslands ? [-2, 0.25, -1.7, 0.25, -1.7, 1.25, -2, 1.25, -1.3, 0.25, -1, 0.25, -1, 1.25, -1.3, 1.25] : [-2, 0.25, -1, 0.25, -1, 1.25, -2, 1.25])
  const uv1 = new Float32Array(uv.length)
  for (let index = 0; index < uv.length; index += 2) {
    uv1[index] = 1 - (uv[index] + 2)
    uv1[index + 1] = uv[index + 1] - 0.25
    if (standard) { uv[index] += 2; uv[index + 1] -= 0.25 }
  }
  const indices = new Uint16Array(splitIslands ? [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7] : [0, 1, 2, 0, 2, 3])
  const arrays = [positions, normals, uv, uv1, indices]
  let length = 0
  const views = arrays.map((array, index) => {
    const entry = { buffer: 0, byteOffset: length, byteLength: array.byteLength, target: index === 4 ? 34963 : 34962 }
    length += array.byteLength
    return entry
  })
  const binary = new Uint8Array(length)
  arrays.forEach((array, index) => binary.set(new Uint8Array(array.buffer), views[index].byteOffset))
  let baseImage: string | undefined
  if (mappedBase) {
    const image = document.createElement('canvas')
    image.width = image.height = 16
    const context = image.getContext('2d')!
    context.fillStyle = '#40c9dd'
    context.fillRect(0, 0, 16, 16)
    context.fillStyle = '#d58e56'
    context.fillRect(0, 0, 8, 8)
    context.fillRect(8, 8, 8, 8)
    baseImage = image.toDataURL('image/png')
  }
  const gltf = {
    asset: { version: '2.0', generator: 'CustomForge print mapping fixture' },
    extensionsUsed: mappedBase ? ['KHR_texture_transform'] : ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'PrintArea', mesh: 0, extras: {
      ...(includeMetadata ? { customforge: { version: 1, canvas, printSurface: { uvChannel: 0, textureFlipY: false, uvMapping: { mode: standard ? 'original' : 'fit-bounds' } } } } : {}),
    } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, ...(missingUv ? {} : { TEXCOORD_0: 2, TEXCOORD_1: 3, TEXCOORD_2: 3, TEXCOORD_3: 3 }) }, indices: 4, material: 0 }] }],
    materials: [{ doubleSided: true, ...(mappedBase ? {} : { extensions: { KHR_materials_unlit: {} } }), pbrMetallicRoughness: {
      baseColorFactor: mappedBase ? [0.8, 0.8, 0.8, 1] : [0, 0.5, 0.7, 1], metallicFactor: 0.2, roughnessFactor: 0.4,
      ...(mappedBase ? { baseColorTexture: { index: 0, texCoord: 1, extensions: { KHR_texture_transform: { offset: [0.13, 0.27], scale: [2, 3], rotation: 0.31 } } } } : {}),
    } }],
    ...(mappedBase ? { images: [{ uri: baseImage }], textures: [{ source: 0, sampler: 0 }], samplers: [{ wrapS: 10497, wrapT: 10497 }] } : {}),
    buffers: [{ byteLength: length }],
    bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: uv.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5126, count: uv1.length / 2, type: 'VEC2' },
      { bufferView: 4, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
  }
  const modelUrl = URL.createObjectURL(new Blob([encodeGlb(gltf, binary)], { type: 'model/gltf-binary' }))
  return { modelUrl, dispose: () => URL.revokeObjectURL(modelUrl) }
}
