import { access, readFile } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)
const stableSemver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, projectRoot), 'utf8'))
}

async function pathExists(relativePath) {
  try {
    await access(new URL(relativePath, projectRoot))
    return true
  } catch {
    return false
  }
}

const packageJson = await readJson('package.json')
const version = packageJson.version

assert(packageJson.name === 'customforge', 'Unexpected package name')
assert(stableSemver.test(version), 'Release version must be stable SemVer')
assert(packageJson.private === false, 'Release package must not be private')
assert(
  packageJson.publishConfig?.access === 'public',
  'Release package must use public access',
)
assert(
  !packageJson.publishConfig?.tag,
  'Stable releases must publish to the default latest tag',
)

const changelog = await readFile(new URL('CHANGELOG.md', projectRoot), 'utf8')
assert(
  new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm')
    .test(changelog),
  `CHANGELOG.md must contain a dated ${version} release heading`,
)

if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert(
    process.env.GITHUB_REF_NAME === `v${version}`,
    `Git tag must be v${version}; received ${process.env.GITHUB_REF_NAME ?? 'none'}`,
  )
}

for (const example of ['api-contract-consumer', 'npm-consumer']) {
  const examplePackage = await readJson(`examples/${example}/package.json`)
  assert(
    examplePackage.dependencies?.customforge ===
      `file:../../customforge-${version}.tgz`,
    `${example} must consume customforge-${version}.tgz`,
  )
  assert(
    !(await pathExists(`examples/${example}/pnpm-lock.yaml`)),
    `${example} must not keep a lockfile tied to a generated tarball`,
  )
}

console.log(`Release metadata verified for customforge@${version}`)
