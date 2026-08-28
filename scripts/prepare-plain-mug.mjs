import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../public/models/plain-mug/plain-mug.glb', import.meta.url)
const outputPath = new URL('../public/models/plain-mug/plain-mug-printarea.glb', import.meta.url)

const COMPONENT_COUNTS = {
  5125: 4,
  5126: 4,
}

const TYPE_COUNTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
}

const source = await readFile(sourcePath)
if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error('Source is not a GLB 2.0 file')
}

let json
let binary
let offset = 12
while (offset < source.length) {
  const length = source.readUInt32LE(offset)
  const type = source.toString('ascii', offset + 4, offset + 8)
  const data = source.subarray(offset + 8, offset + 8 + length)
  if (type === 'JSON') {
    json = JSON.parse(data.toString('utf8').replace(/\u0000+$/, ''))
  } else if (type.startsWith('BIN')) {
    binary = Buffer.from(data)
  }
  offset += 8 + length
}

if (!json || !binary || json.buffers?.length !== 1) {
  throw new Error('Expected one embedded GLB buffer')
}

const primitive = json.meshes?.[0]?.primitives?.[0]
if (!primitive || primitive.mode !== undefined && primitive.mode !== 4) {
  throw new Error('Expected one triangle primitive')
}

function readAccessor(accessorIndex, itemIndex) {
  const accessor = json.accessors[accessorIndex]
  const view = json.bufferViews[accessor.bufferView]
  const componentSize = COMPONENT_COUNTS[accessor.componentType]
  const componentCount = TYPE_COUNTS[accessor.type]
  if (!componentSize || !componentCount) {
    throw new Error(`Unsupported accessor ${accessorIndex}`)
  }

  const stride = view.byteStride ?? componentSize * componentCount
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + itemIndex * stride
  const values = []
  for (let index = 0; index < componentCount; index += 1) {
    const componentOffset = start + index * componentSize
    values.push(
      accessor.componentType === 5125
        ? binary.readUInt32LE(componentOffset)
        : binary.readFloatLE(componentOffset),
    )
  }
  return values
}

const positionAccessor = primitive.attributes.POSITION
const normalAccessor = primitive.attributes.NORMAL
const indexAccessor = primitive.indices
const indexCount = json.accessors[indexAccessor].count
const triangles = []

for (let index = 0; index < indexCount; index += 3) {
  const vertexIndices = [0, 1, 2].map((step) => readAccessor(indexAccessor, index + step)[0])
  const positions = vertexIndices.map((vertexIndex) => readAccessor(positionAccessor, vertexIndex))
  const center = [0, 1, 2].map(
    (axis) => (positions[0][axis] + positions[1][axis] + positions[2][axis]) / 3,
  )
  const firstEdge = positions[1].map((value, axis) => value - positions[0][axis])
  const secondEdge = positions[2].map((value, axis) => value - positions[0][axis])
  const faceNormal = [
    firstEdge[1] * secondEdge[2] - firstEdge[2] * secondEdge[1],
    firstEdge[2] * secondEdge[0] - firstEdge[0] * secondEdge[2],
    firstEdge[0] * secondEdge[1] - firstEdge[1] * secondEdge[0],
  ]
  const normalLength = Math.hypot(...faceNormal)
  const normalized = faceNormal.map((value) => value / normalLength)
  const radius = Math.hypot(center[0], center[1])
  const outward = radius
    ? (normalized[0] * center[0] + normalized[1] * center[1]) / radius
    : -1

  triangles.push({
    vertexIndices,
    positions,
    candidate:
      center[2] >= 0.012 &&
      center[2] <= 0.143 &&
      radius >= 0.06 &&
      radius <= 0.066 &&
      outward >= 0.7,
  })
}

const vertexTriangles = new Map()
triangles.forEach((triangle, triangleIndex) => {
  if (!triangle.candidate) {
    return
  }
  triangle.vertexIndices.forEach((vertexIndex) => {
    const related = vertexTriangles.get(vertexIndex) ?? []
    related.push(triangleIndex)
    vertexTriangles.set(vertexIndex, related)
  })
})

const remaining = new Set(
  triangles.flatMap((triangle, triangleIndex) => triangle.candidate ? [triangleIndex] : []),
)
const components = []
while (remaining.size) {
  const component = new Set()
  const stack = [remaining.values().next().value]
  remaining.delete(stack[0])
  while (stack.length) {
    const triangleIndex = stack.pop()
    component.add(triangleIndex)
    triangles[triangleIndex].vertexIndices.forEach((vertexIndex) => {
      for (const neighbor of vertexTriangles.get(vertexIndex) ?? []) {
        if (remaining.delete(neighbor)) {
          stack.push(neighbor)
        }
      }
    })
  }
  components.push(component)
}

const printTriangles = components.sort((first, second) => second.size - first.size)[0]
if (!printTriangles || printTriangles.size < 2000) {
  throw new Error('Could not isolate the mug exterior')
}

const bodyIndices = []
const printPositions = []
const printNormals = []
const printUvs = []
let minimumZ = Infinity
let maximumZ = -Infinity

for (const triangleIndex of printTriangles) {
  for (const position of triangles[triangleIndex].positions) {
    minimumZ = Math.min(minimumZ, position[2])
    maximumZ = Math.max(maximumZ, position[2])
  }
}

triangles.forEach((triangle, triangleIndex) => {
  if (!printTriangles.has(triangleIndex)) {
    bodyIndices.push(...triangle.vertexIndices)
    return
  }

  const triangleUvs = triangle.positions.map((position) => ({
    u: ((Math.atan2(position[1], position[0]) - Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) /
      (Math.PI * 2),
    v: (position[2] - minimumZ) / (maximumZ - minimumZ),
  }))
  const uValues = triangleUvs.map(({ u }) => u)
  if (Math.max(...uValues) - Math.min(...uValues) > 0.5) {
    triangleUvs.forEach((uv) => {
      if (uv.u > 0.5) {
        uv.u = 0
      }
    })
  }

  triangle.vertexIndices.forEach((vertexIndex, vertexOffset) => {
    printPositions.push(...triangle.positions[vertexOffset])
    printNormals.push(...readAccessor(normalAccessor, vertexIndex))
    printUvs.push(triangleUvs[vertexOffset].u, triangleUvs[vertexOffset].v)
  })
})

const chunks = [binary]
let binaryLength = binary.length
function appendBuffer(data) {
  const paddingLength = (4 - binaryLength % 4) % 4
  if (paddingLength) {
    chunks.push(Buffer.alloc(paddingLength))
    binaryLength += paddingLength
  }
  const byteOffset = binaryLength
  chunks.push(data)
  binaryLength += data.length
  return { byteOffset, byteLength: data.length }
}

function floatBuffer(values) {
  const data = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => data.writeFloatLE(value, index * 4))
  return data
}

function uintBuffer(values) {
  const data = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => data.writeUInt32LE(value, index * 4))
  return data
}

function addAccessor(data, componentType, count, type, target, bounds) {
  const appended = appendBuffer(data)
  const bufferView = json.bufferViews.push({ buffer: 0, ...appended, target }) - 1
  return json.accessors.push({ bufferView, componentType, count, type, ...bounds }) - 1
}

const bodyIndexAccessor = addAccessor(
  uintBuffer(bodyIndices),
  5125,
  bodyIndices.length,
  'SCALAR',
  34963,
  { min: [Math.min(...bodyIndices)], max: [Math.max(...bodyIndices)] },
)
const printVertexCount = printPositions.length / 3
const printPositionAccessor = addAccessor(
  floatBuffer(printPositions),
  5126,
  printVertexCount,
  'VEC3',
  34962,
  {
    min: [0, 1, 2].map((axis) => Math.min(...printPositions.filter((_, index) => index % 3 === axis))),
    max: [0, 1, 2].map((axis) => Math.max(...printPositions.filter((_, index) => index % 3 === axis))),
  },
)
const printNormalAccessor = addAccessor(
  floatBuffer(printNormals),
  5126,
  printVertexCount,
  'VEC3',
  34962,
  {
    min: [0, 1, 2].map((axis) => Math.min(...printNormals.filter((_, index) => index % 3 === axis))),
    max: [0, 1, 2].map((axis) => Math.max(...printNormals.filter((_, index) => index % 3 === axis))),
  },
)
const printUvAccessor = addAccessor(
  floatBuffer(printUvs),
  5126,
  printVertexCount,
  'VEC2',
  34962,
  { min: [0, 0], max: [1, 1] },
)

primitive.indices = bodyIndexAccessor
json.meshes[0].name = 'MugBody'
json.nodes[2].name = 'MugBody'

const printMaterial = json.materials.push({
  name: 'PrintAreaMaterial',
  doubleSided: true,
  pbrMetallicRoughness: {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 0.42,
  },
}) - 1
const printMesh = json.meshes.push({
  name: 'PrintArea',
  primitives: [{
    attributes: {
      POSITION: printPositionAccessor,
      NORMAL: printNormalAccessor,
      TEXCOORD_0: printUvAccessor,
    },
    material: printMaterial,
    mode: 4,
  }],
}) - 1
const printNode = json.nodes.push({ name: 'PrintArea', mesh: printMesh }) - 1
json.nodes[1].children.push(printNode)

const outputBinary = Buffer.concat(chunks)
json.buffers[0].byteLength = outputBinary.length
const jsonText = JSON.stringify(json)
const jsonPadding = (4 - Buffer.byteLength(jsonText) % 4) % 4
const jsonChunk = Buffer.from(jsonText + ' '.repeat(jsonPadding))
const binaryPadding = (4 - outputBinary.length % 4) % 4
const binaryChunk = Buffer.concat([outputBinary, Buffer.alloc(binaryPadding)])
const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length
const header = Buffer.alloc(12)
header.write('glTF', 0, 'ascii')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(totalLength, 8)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonChunk.length, 0)
jsonHeader.write('JSON', 4, 'ascii')
const binaryHeader = Buffer.alloc(8)
binaryHeader.writeUInt32LE(binaryChunk.length, 0)
binaryHeader.write('BIN\0', 4, 'ascii')

await writeFile(outputPath, Buffer.concat([header, jsonHeader, jsonChunk, binaryHeader, binaryChunk]))
console.log(`Prepared ${printTriangles.size} print triangles and ${bodyIndices.length / 3} body triangles`)
