import { readFile, readdir, stat } from 'node:fs/promises'
import { parseAst } from 'vite'

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
  const program = parseAst(source)
  const specifiers = []

  function visit(node) {
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration']
        .includes(node.type) &&
      typeof node.source?.value === 'string'
    ) {
      specifiers.push(node.source.value)
    } else if (
      node.type === 'ImportExpression' &&
      typeof node.source?.value === 'string'
    ) {
      specifiers.push(node.source.value)
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach((child) => {
          if (child && typeof child.type === 'string') {
            visit(child)
          }
        })
      } else if (
        value &&
        typeof value === 'object' &&
        typeof value.type === 'string'
      ) {
        visit(value)
      }
    }
  }

  visit(program)
  return specifiers
}

const importParserFixture = collectImportSpecifiers(`
  import value from 'runtime-package'
  export { value as default } from 're-export-package'
  const lazyModule = import('lazy-package')
  const documentation = "import { icons } from 'lucide'"
`)
assert(
  importParserFixture.join(',') ===
    'runtime-package,re-export-package,lazy-package',
  'ESM import parser matched documentation text or missed runtime imports',
)

const packageJson = JSON.parse(await readProjectFile('package.json'))

assert(packageJson.name === 'customforge', 'Unexpected package name')
assert(packageJson.version === '0.1.0-alpha.2', 'Unexpected package version')
assert(packageJson.private === false, 'Public alpha package must not be private')
assert(packageJson.publishConfig?.access === 'public', 'Public package access is invalid')
assert(packageJson.publishConfig?.tag === 'alpha', 'Public package tag must remain alpha')
assert(packageJson.type === 'module', 'Package must use ESM')
assert(packageJson.types === './dist/index.d.ts', 'Package types entry is invalid')
assert(packageJson.exports?.['.']?.import === './dist/index.js', 'ESM export is invalid')
assert(packageJson.exports?.['.']?.types === './dist/index.d.ts', 'Types export is invalid')
assert(
  packageJson.exports?.['./workbench']?.import === './dist/workbench.js',
  'Workbench ESM export is invalid',
)
assert(
  packageJson.exports?.['./workbench']?.types === './dist/workbench/index.d.ts',
  'Workbench types export is invalid',
)
assert(packageJson.exports?.['./style.css'] === './dist/style.css', 'Style export is invalid')
assert(packageJson.dependencies?.fabric, 'Fabric.js must be a runtime dependency')
assert(packageJson.dependencies?.three, 'Three.js must be a runtime dependency')
assert(!packageJson.peerDependencies?.fabric, 'Fabric.js must not be a peer dependency')
assert(!packageJson.peerDependencies?.three, 'Three.js must not be a peer dependency')
assert(!packageJson.dependencies?.lucide, 'Bundled icon package must not be a runtime dependency')

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
  'LICENSES',
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
  'workbench.js',
  'workbench.js.map',
  'workbench/CustomForgeWorkbench.d.ts',
  'workbench/index.d.ts',
  'workbench/types.d.ts',
]
const distUrl = new URL('dist/', projectRoot)
const distFiles = await listFiles(distUrl)
const defaultModelFile = distFiles.find((file) =>
  /^assets\/cup_decal_small_margins(?:-[A-Za-z0-9_-]+)?\.glb$/.test(file),
)

assert(defaultModelFile, 'Bundled cup_decal_small_margins.glb asset is missing')
const defaultModelStats = await stat(
  new URL(`dist/${defaultModelFile}`, projectRoot),
)
assert(defaultModelStats.size > 0, 'Bundled cup_decal_small_margins.glb asset is empty')

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
const runtimeJavaScriptFiles = distFiles.filter((file) => file.endsWith('.js'))
const runtimeSources = await Promise.all(
  runtimeJavaScriptFiles.map((file) => readProjectFile(`dist/${file}`)),
)
assert(
  runtimeSources.some((source) => source.includes(defaultModelFile)),
  'Runtime bundles do not reference the bundled cup_decal_small_margins.glb asset',
)
const runtimeImportSpecifiers = runtimeSources.flatMap(collectImportSpecifiers)
assert(
  runtimeImportSpecifiers.some(
    (specifier) => specifier === 'fabric' || specifier.startsWith('fabric/'),
  ),
  'Fabric.js is missing as an external import',
)
assert(
  runtimeImportSpecifiers.some(
    (specifier) => specifier === 'three' || specifier.startsWith('three/'),
  ),
  'Three.js is missing as an external import',
)
assert(!importSpecifiers.some((specifier) => specifier === 'lucide'), 'Workbench icon dependency leaked into the core bundle')
assert(!librarySource.includes('Texture pipeline prototype'), 'Demo source leaked into bundle')

const libraryStats = await stat(new URL('dist/index.js', projectRoot))
assert(libraryStats.size < 250_000, 'Library bundle is too large; external dependencies may be bundled')

const workbenchSource = await readProjectFile('dist/workbench.js')
assert(
  workbenchSource.includes('CustomForgeWorkbench'),
  'Workbench class is missing from its public entry',
)
assert(
  !runtimeImportSpecifiers.some((specifier) => specifier === 'lucide'),
  'Workbench icons must be bundled instead of becoming a consumer dependency',
)
let runtimeJavaScriptSize = 0
for (const file of runtimeJavaScriptFiles) {
  runtimeJavaScriptSize += (await stat(new URL(`dist/${file}`, projectRoot))).size
}
assert(runtimeJavaScriptSize < 500_000, 'Library JavaScript output is unexpectedly large')

for (const file of distFiles.filter((entry) => entry.endsWith('.js.map'))) {
  const sourceMap = JSON.parse(await readProjectFile(`dist/${file}`))
  for (const source of sourceMap.sources ?? []) {
    assert(!source.includes('/demo/'), `Demo source leaked into source map: ${source}`)
    assert(!source.includes('.test.'), `Test source leaked into source map: ${source}`)
  }
}

const coreStyle = await readProjectFile('dist/style.css')
assert(coreStyle.includes('.customforge-design-canvas'), 'Editor core style is missing')
assert(coreStyle.includes('.customforge-uv-layout'), 'UV editor overlay style is missing')
assert(coreStyle.includes('.customforge-viewer-canvas'), 'Viewer core style is missing')
assert(coreStyle.includes('.customforge-workbench'), 'Workbench style is missing')
assert(coreStyle.includes('@font-face'), 'Bundled font declaration is missing')
assert(coreStyle.includes('Nunito Sans'), 'Bundled Workbench font is missing')
assert(!coreStyle.includes('data:font/'), 'Workbench font must not be inlined in CSS')
const nunitoFontFile = distFiles.find((file) => /NunitoSans.*\.ttf$/i.test(file))
assert(nunitoFontFile, 'Bundled Nunito Sans font asset is missing')
assert(coreStyle.includes(nunitoFontFile), 'Workbench CSS does not reference its font asset')
const coreStyleStats = await stat(new URL('dist/style.css', projectRoot))
assert(coreStyleStats.size < 250_000, 'Core stylesheet is unexpectedly large')
assert(
  !/(^|})\s*(?:\*|:root|html|body|button|input)(?:\b|\s|,|\{)/m.test(coreStyle),
  'Core style contains an unsupported global selector',
)

const rootDeclaration = await readProjectFile('dist/index.d.ts')
assert(!rootDeclaration.includes('/src/'), 'Root declaration contains a source path')
assert(!rootDeclaration.includes('/demo/'), 'Demo type leaked into root declaration')
assert(rootDeclaration.includes('DesignDocument'), 'Design document type is missing')
assert(rootDeclaration.includes('DesignImageRole'), 'Design image role type is missing')
assert(rootDeclaration.includes('HistoryState'), 'History state type is missing')
assert(rootDeclaration.includes('CustomizerEventMap'), 'Customizer event map type is missing')

const coreTypesDeclaration = await readProjectFile('dist/core/types.d.ts')
assert(coreTypesDeclaration.includes('historychange'), 'History event type is missing')

const workbenchDeclaration = await readProjectFile('dist/workbench/index.d.ts')
assert(workbenchDeclaration.includes('createWorkbench'), 'Workbench factory type is missing')
assert(workbenchDeclaration.includes('WorkbenchOptions'), 'Workbench option type is missing')
assert(workbenchDeclaration.includes('WorkbenchBranding'), 'Workbench branding type is missing')
assert(workbenchDeclaration.includes('WorkbenchLabels'), 'Workbench label type is missing')
assert(workbenchDeclaration.includes('WorkbenchTheme'), 'Workbench theme type is missing')
assert(
  workbenchDeclaration.includes('WorkbenchIconConfiguration'),
  'Workbench icon type is missing',
)
assert(workbenchDeclaration.includes('WorkbenchTextPreset'), 'Workbench text preset type is missing')
assert(workbenchDeclaration.includes('WorkbenchAsset'), 'Workbench asset type is missing')
assert(!workbenchDeclaration.includes('/demo/'), 'Demo type leaked into Workbench declaration')

const customizerDeclaration = await readProjectFile(
  'dist/customizer/ProductCustomizer.d.ts',
)
assert(!customizerDeclaration.includes('DesignEditor'), 'Editor type leaked into public class')
assert(!customizerDeclaration.includes('ProductViewer'), 'Viewer type leaked into public class')
assert(customizerDeclaration.includes('saveDesign'), 'Design save method is missing')
assert(customizerDeclaration.includes('loadDesign'), 'Design load method is missing')
assert(customizerDeclaration.includes('moveObject'), 'Object layer method is missing')
assert(customizerDeclaration.includes('setObjectVisibility'), 'Object visibility method is missing')
assert(customizerDeclaration.includes('canUndo'), 'History query method is missing')
assert(customizerDeclaration.includes('canRedo'), 'Redo query method is missing')
assert(customizerDeclaration.includes('undo'), 'Undo method is missing')
assert(customizerDeclaration.includes('redo'), 'Redo method is missing')
assert(customizerDeclaration.includes('clearHistory'), 'History reset method is missing')
assert(
  workbenchSource.includes('data:image/png') ||
    distFiles.some((file) => /CustomForgeLogo.*\.png$/i.test(file)),
  'Default Workbench logo is missing',
)

const expectedPackageFiles = [
  ...distFiles.map((file) => `dist/${file}`),
  ...approvedPackageFiles.filter(
    (file) => file !== 'dist' && file !== 'LICENSES',
  ),
  ...(await listFiles(new URL('LICENSES/', projectRoot))).map(
    (file) => `LICENSES/${file}`,
  ),
  'package.json',
].sort()
const expectedPackageFileSet = new Set(expectedPackageFiles)
const nunitoLicense = await readProjectFile('LICENSES/NunitoSans-OFL.txt')
assert(nunitoLicense.includes('SIL OPEN FONT LICENSE Version 1.1'), 'Nunito Sans OFL license is invalid')
const plainMugLicense = await readProjectFile('LICENSES/plain-mug-CC-BY-4.0.txt')
assert(
  plainMugLicense.includes('Creative Commons Attribution 4.0 International'),
  'Plain Mug attribution is invalid',
)
assert(plainMugLicense.includes('LightSwitch'), 'Plain Mug author attribution is missing')
const requiredPackedFiles = [
  'CHANGELOG.md',
  'LICENSE',
  'LICENSES/NunitoSans-OFL.txt',
  'LICENSES/plain-mug-CC-BY-4.0.txt',
  'README.md',
  'README.zh-CN.md',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/style.css',
  'dist/workbench.js',
  'dist/workbench/CustomForgeWorkbench.d.ts',
  'dist/workbench/index.d.ts',
  'dist/workbench/types.d.ts',
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
  /(?:^|\/)vite(?:\.[^.]+)?\.config\.ts$/,
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
