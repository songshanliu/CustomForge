const GRID_CELL_COUNT = 154
const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const JSON_CHUNK_TYPE = 0x4e4f534a
const BINARY_CHUNK_TYPE = 0x004e4942

function alignToFour(value: number): number {
  return (value + 3) & ~3
}

/**
 * 创建只供浏览器回归使用的高面数 GLB，并返回可释放的 Blob URL
 *
 * 模型使用规则网格生成 47,432 个三角形和完整 0～1 UV，不写入仓库制品
 *
 * @returns 模型地址、三角形数量和释放 Blob URL 的函数
 */
export function createHighDensityProductFixture() {
  const pointsPerSide = GRID_CELL_COUNT + 1
  const vertexCount = pointsPerSide * pointsPerSide
  const triangleCount = GRID_CELL_COUNT * GRID_CELL_COUNT * 2
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices = new Uint16Array(triangleCount * 3)

  let positionOffset = 0
  let uvOffset = 0
  for (let row = 0; row < pointsPerSide; row += 1) {
    const v = row / GRID_CELL_COUNT
    for (let column = 0; column < pointsPerSide; column += 1) {
      const u = column / GRID_CELL_COUNT
      positions[positionOffset] = u * 2 - 1
      positions[positionOffset + 1] = v * 2 - 1
      positions[positionOffset + 2] = 0
      normals[positionOffset] = 0
      normals[positionOffset + 1] = 0
      normals[positionOffset + 2] = 1
      uvs[uvOffset] = u
      uvs[uvOffset + 1] = v
      positionOffset += 3
      uvOffset += 2
    }
  }

  let indexOffset = 0
  for (let row = 0; row < GRID_CELL_COUNT; row += 1) {
    for (let column = 0; column < GRID_CELL_COUNT; column += 1) {
      const topLeft = row * pointsPerSide + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + pointsPerSide
      const bottomRight = bottomLeft + 1
      indices.set(
        [topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft],
        indexOffset,
      )
      indexOffset += 6
    }
  }

  const positionsByteOffset = 0
  const normalsByteOffset = alignToFour(positions.byteLength)
  const uvsByteOffset = alignToFour(normalsByteOffset + normals.byteLength)
  const indicesByteOffset = alignToFour(uvsByteOffset + uvs.byteLength)
  const binaryByteLength = alignToFour(indicesByteOffset + indices.byteLength)
  const binary = new Uint8Array(binaryByteLength)
  binary.set(new Uint8Array(positions.buffer), positionsByteOffset)
  binary.set(new Uint8Array(normals.buffer), normalsByteOffset)
  binary.set(new Uint8Array(uvs.buffer), uvsByteOffset)
  binary.set(new Uint8Array(indices.buffer), indicesByteOffset)

  const document = {
    asset: { version: '2.0', generator: 'CustomForge browser performance fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'PrintArea' }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [{
      name: 'Printable surface',
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    }],
    buffers: [{ byteLength: binaryByteLength }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: positionsByteOffset,
        byteLength: positions.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: normalsByteOffset,
        byteLength: normals.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: uvsByteOffset,
        byteLength: uvs.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: indicesByteOffset,
        byteLength: indices.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
        min: [-1, -1, 0],
        max: [1, 1, 0],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
        min: [0, 0, 1],
        max: [0, 0, 1],
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC2',
        min: [0, 0],
        max: [1, 1],
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
        min: [0],
        max: [vertexCount - 1],
      },
    ],
  }

  const json = new TextEncoder().encode(JSON.stringify(document))
  const paddedJsonLength = alignToFour(json.byteLength)
  const paddedBinaryLength = alignToFour(binary.byteLength)
  const binaryHeaderOffset = 20 + paddedJsonLength
  const totalLength = binaryHeaderOffset + 8 + paddedBinaryLength
  const glb = new Uint8Array(totalLength)
  const header = new DataView(glb.buffer)

  header.setUint32(0, GLB_MAGIC, true)
  header.setUint32(4, GLB_VERSION, true)
  header.setUint32(8, totalLength, true)
  header.setUint32(12, paddedJsonLength, true)
  header.setUint32(16, JSON_CHUNK_TYPE, true)
  glb.fill(0x20, 20, 20 + paddedJsonLength)
  glb.set(json, 20)
  header.setUint32(binaryHeaderOffset, paddedBinaryLength, true)
  header.setUint32(binaryHeaderOffset + 4, BINARY_CHUNK_TYPE, true)
  glb.set(binary, binaryHeaderOffset + 8)

  const modelUrl = URL.createObjectURL(new Blob([glb], {
    type: 'model/gltf-binary',
  }))

  return {
    modelUrl,
    triangleCount,
    dispose: () => URL.revokeObjectURL(modelUrl),
  }
}
