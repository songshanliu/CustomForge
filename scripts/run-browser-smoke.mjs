import { spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const consumerRoot = fileURLToPath(
  new URL('../examples/api-contract-consumer/', import.meta.url),
)
const viteEntry = join(consumerRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const smokeUrl = 'http://127.0.0.1:5175/?smoke=1'

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function findBrowser() {
  const pathCandidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : undefined,
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      : undefined,
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
  ].filter(Boolean)

  for (const candidate of pathCandidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Continue to PATH-based candidates
    }
  }

  const executableNames = process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']

  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    for (const executable of executableNames) {
      const candidate = join(directory, executable)
      try {
        await access(candidate)
        return candidate
      } catch {
        // Continue searching
      }
    }
  }

  throw new Error('Chrome or Edge was not found; set CHROME_PATH')
}

async function waitForServer(server, output) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before startup\n${output()}`)
    }
    try {
      const response = await fetch(smokeUrl)
      if (response.ok) {
        return
      }
    } catch {
      // The server may still be starting
    }
    await delay(200)
  }
  throw new Error(`Timed out waiting for ${smokeUrl}\n${output()}`)
}

function runBrowser(browser, profileDirectory) {
  return new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=30000',
      '--dump-dom',
      `--user-data-dir=${profileDirectory}`,
      smokeUrl,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Browser smoke test timed out'))
    }, 60_000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(
          `Browser exited with ${signal ?? `exit code ${code}`}\n${stderr}`,
        ))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

await access(viteEntry)
const browser = await findBrowser()
const profileDirectory = await mkdtemp(join(tmpdir(), 'customforge-smoke-'))
let serverOutput = ''
const server = spawn(process.execPath, [
  viteEntry,
  '--host',
  '127.0.0.1',
  '--port',
  '5175',
  '--strictPort',
], {
  cwd: consumerRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.setEncoding('utf8')
server.stderr.setEncoding('utf8')
server.stdout.on('data', (chunk) => { serverOutput += chunk })
server.stderr.on('data', (chunk) => { serverOutput += chunk })

try {
  await waitForServer(server, () => serverOutput)
  const result = await runBrowser(browser, profileDirectory)
  if (!result.stdout.includes('data-smoke-status="passed"')) {
    const failure = result.stdout.match(/data-smoke-error="([^"]*)"/)?.[1]
    throw new Error(
      `Browser smoke test did not report success${failure ? `: ${failure}` : ''}\n${result.stderr}`,
    )
  }
  console.log('Browser smoke test passed')
} finally {
  if (server.exitCode === null) {
    server.kill()
  }
  await rm(profileDirectory, { recursive: true, force: true })
}
