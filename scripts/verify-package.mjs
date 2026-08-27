import { readFile, readdir, stat } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, projectRoot), 'utf8')
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...(await listFiles(new URL(`${entry.name}/`, directory), relativePath)))
    } else {
      files.push(relativePath)
    }
  }

  return files
}

function collectImportSpecifiers(source) {
  const specifiers = []
  const pattern = /\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g

  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2])
  }

  return specifiers
}

const packageJson = JSON.parse(await readProjectFile('package.json'))

assert(packageJson.name === 'customforge', 'Unexpected package name')
assert(packageJson.version === '0.1.0-alpha.1', 'Unexpected package version')
assert(packageJson.private === false, 'Public alpha package must not be private')
assert(packageJson.publishConfig?.access === 'public', 'Public package access is invalid')
assert(packageJson.publishConfig?.tag === 'alpha', 'Public package tag must remain alpha')
assert(packageJson.type === 'module', 'Package must use ESM')
assert(packageJson.types === './dist/index.d.ts', 'Package types entry is invalid')
assert(packageJson.exports?.['.']?.import === './dist/index.js', 'ESM export is invalid')
assert(packageJson.exports?.['.']?.types === './dist/index.d.ts', 'Types export is invalid')
assert(packageJson.exports?.['./style.css'] === './dist/style.css', 'Style export is invalid')
assert(packageJson.dependencies?.fabric, 'Fabric.js must be a runtime dependency')
assert(packageJson.dependencies?.three, 'Three.js must be a runtime dependency')
assert(!packageJson.peerDependencies?.fabric, 'Fabric.js must not be a peer dependency')
assert(!packageJson.peerDependencies?.three, 'Three.js must not be a peer dependency')
assert(!packageJson.dependencies?.lucide, 'Demo icon package must not be a runtime dependency')

const changelog = await readProjectFile('CHANGELOG.md')
assert(
  changelog.includes(`## [${packageJson.version}]`),
  'Current package version is missing from CHANGELOG.md',
)

const approvedPackageFiles = [
  'dist',
  'README.md',
  'README.zh-CN.md',
  'CHANGELOG.md',
  'LICENSE',
]
assert(
  Array.isArray(packageJson.files) &&
    packageJson.files.length === approvedPackageFiles.length &&
    approvedPackageFiles.every((file) => packageJson.files.includes(file)),
  `Package files whitelist must be exactly: ${approvedPackageFiles.join(', ')}`,
)

const requiredDistFiles = [
  'index.d.ts',
  'index.d.ts.map',
  'index.js',
  'index.js.map',
  'style.css',
  'core/types.d.ts',
  'customizer/ProductCustomizer.d.ts',
]
const distUrl = new URL('dist/', projectRoot)
const distFiles = await listFiles(distUrl)

for (const requiredFile of requiredDistFiles) {
  assert(distFiles.includes(requiredFile), `Missing dist file: ${requiredFile}`)
}

for (const file of distFiles) {
  assert(!file.includes('/demo/'), `Demo file leaked into dist: ${file}`)
  assert(!file.includes('.test.'), `Test file leaked into dist: ${file}`)
  assert(!file.endsWith('vite-env.d.ts'), `Vite declaration leaked into dist: ${file}`)
}

const librarySource = await readProjectFile('dist/index.js')
const importSpecifiers = collectImportSpecifiers(librarySource)
assert(
  importSpecifiers.some((specifier) => specifier === 'fabric' || specifier.startsWith('fabric/')),
  'Fabric.js is missing as an external import',
)
assert(
  importSpecifiers.some((specifier) => specifier === 'three' || specifier.startsWith('three/')),
  'Three.js is missing as an external import',
)
assert(!importSpecifiers.some((specifier) => specifier === 'lucide'), 'Demo dependency leaked into bundle')
assert(!librarySource.includes('Texture pipeline prototype'), 'Demo source leaked into bundle')

const libraryStats = await stat(new URL('dist/index.js', projectRoot))
assert(libraryStats.size < 250_000, 'Library bundle is too large; external dependencies may be bundled')

const sourceMap = JSON.parse(await readProjectFile('dist/index.js.map'))
for (const source of sourceMap.sources ?? []) {
  assert(!source.includes('/demo/'), `Demo source leaked into source map: ${source}`)
  assert(!source.includes('.test.'), `Test source leaked into source map: ${source}`)
}

const coreStyle = await readProjectFile('dist/style.css')
assert(coreStyle.includes('.customforge-design-canvas'), 'Editor core style is missing')
assert(coreStyle.includes('.customforge-viewer-canvas'), 'Viewer core style is missing')
assert(
  !/(^|})\s*(?:\*|:root|html|body|button|input)(?:\b|\s|,|\{)/m.test(coreStyle),
  'Core style contains an unsupported global selector',
)

const rootDeclaration = await readProjectFile('dist/index.d.ts')
assert(!rootDeclaration.includes('/src/'), 'Root declaration contains a source path')
assert(!rootDeclaration.includes('/demo/'), 'Demo type leaked into root declaration')
assert(rootDeclaration.includes('DesignDocument'), 'Design document type is missing')

const customizerDeclaration = await readProjectFile(
  'dist/customizer/ProductCustomizer.d.ts',
)
assert(!customizerDeclaration.includes('DesignEditor'), 'Editor type leaked into public class')
assert(!customizerDeclaration.includes('ProductViewer'), 'Viewer type leaked into public class')
assert(customizerDeclaration.includes('saveDesign'), 'Design save method is missing')
assert(customizerDeclaration.includes('loadDesign'), 'Design load method is missing')

const expectedPackageFiles = [
  ...distFiles.map((file) => `dist/${file}`),
  ...approvedPackageFiles.filter((file) => file !== 'dist'),
  'package.json',
].sort()
const expectedPackageFileSet = new Set(expectedPackageFiles)
const requiredPackedFiles = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/style.css',
  'package.json',
]

for (const requiredFile of requiredPackedFiles) {
  assert(expectedPackageFileSet.has(requiredFile), `Missing packed file: ${requiredFile}`)
}

const forbiddenPackedPaths = [
  /^dev-doc\//,
  /^examples\//,
  /^node_modules\//,
  /^scripts\//,
  /^src\//,
  /\.test\./,
  /(?:^|\/)vite(?:\.lib)?\.config\.ts$/,
]

for (const file of expectedPackageFileSet) {
  assert(
    !forbiddenPackedPaths.some((pattern) => pattern.test(file)),
    `Forbidden file included in package: ${file}`,
  )
}

let unpackedSize = 0

for (const file of expectedPackageFiles) {
  const fileStats = await stat(new URL(file, projectRoot))
  assert(fileStats.isFile(), `Package entry is not a file: ${file}`)
  unpackedSize += fileStats.size
}

console.log(
  `Package verified: ${packageJson.name}-${packageJson.version}.tgz (${expectedPackageFiles.length} files, ${unpackedSize} bytes unpacked)`,
)
