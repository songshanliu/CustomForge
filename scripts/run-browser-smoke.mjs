import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const consumerRoot = fileURLToPath(
  new URL('../examples/api-contract-consumer/', import.meta.url),
)
const viteEntry = join(consumerRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const installedPackageDist = join(
  consumerRoot,
  'node_modules',
  'customforge',
  'dist',
)
const smokePort = Number(process.env.CUSTOMFORGE_SMOKE_PORT ?? 5175)
if (!Number.isInteger(smokePort) || smokePort < 1 || smokePort > 65535) throw new Error('CUSTOMFORGE_SMOKE_PORT must be a valid TCP port')
const serverUrl = `http://127.0.0.1:${smokePort}/`
const realModelPath = process.env.CUSTOMFORGE_SMOKE_MODEL
const realModelRevision = realModelPath ? createHash('sha256').update(await readFile(realModelPath)).digest('hex') : undefined
const modelQuery = realModelRevision ? `&real-model=${realModelRevision}` : ''
const baselineDirectory = process.env.CUSTOMFORGE_SMOKE_BASELINE
const baselineQuery = baselineDirectory ? `&baseline=${encodeURIComponent(`/@fs/${baselineDirectory.replaceAll('\\', '/')}/workbench.js`)}` : ''
const desktopSmokeUrl = `${serverUrl}?smoke=desktop${modelQuery}${baselineQuery}`
const mobileSmokeUrl = `${serverUrl}?smoke=mobile${modelQuery}${baselineQuery}`
const browserStartupTimeoutMs = 10_000
const smokeTimeoutMs = realModelPath ? 180_000 : 90_000

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path)
    }
  }

  return files
}

async function assertInstalledPackageIsFresh() {
  const runtimeFiles = await listJavaScriptFiles(installedPackageDist)
  const runtimeSources = await Promise.all(
    runtimeFiles.map((file) => readFile(file, 'utf8')),
  )
  const staleMarkers = ['readPixels(', 'getImageData(', 'renderState']
  const detectedMarkers = staleMarkers.filter((marker) =>
    runtimeSources.some((source) => source.includes(marker)),
  )

  if (detectedMarkers.length > 0) {
    throw new Error(
      'The api-contract-consumer has a stale customforge package installed ' +
      `(${detectedMarkers.join(', ')} detected). ` +
      'Run "pnpm pack:local" and then "pnpm verify:consumers" before ' +
      'running "pnpm test:browser".',
    )
  }
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
      const response = await fetch(serverUrl)
      if (response.ok) {
        return
      }
    } catch {
      // The server may still be starting
    }
    await delay(200)
  }
  throw new Error(`Timed out waiting for ${serverUrl}\n${output()}`)
}

async function waitForDevToolsPort(browser, profileDirectory, getStderr) {
  const portFile = join(profileDirectory, 'DevToolsActivePort')
  const deadline = Date.now() + browserStartupTimeoutMs

  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Browser exited before DevTools startup\n${getStderr()}`)
    }
    try {
      const [port] = (await readFile(portFile, 'utf8')).split(/\r?\n/)
      if (/^\d+$/.test(port)) {
        return Number(port)
      }
    } catch (error) {
      if (!['ENOENT', 'EBUSY', 'EACCES'].includes(error?.code)) {
        throw error
      }
    }
    await delay(50)
  }

  throw new Error(`Timed out waiting for Chrome DevTools\n${getStderr()}`)
}

async function waitForPageTarget(port, browser, getStderr) {
  const deadline = Date.now() + browserStartupTimeoutMs

  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Browser exited before page target startup\n${getStderr()}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const targets = await response.json()
        const page = targets.find((target) =>
          target.type === 'page' && target.webSocketDebuggerUrl,
        )
        if (page) {
          return page.webSocketDebuggerUrl
        }
      }
    } catch {
      // DevTools may not have published its HTTP endpoint yet
    }
    await delay(50)
  }

  throw new Error(`Timed out waiting for a Chrome page target\n${getStderr()}`)
}

function connectToDevTools(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl)
    const pending = new Map()
    const exceptions = []
    let nextId = 1

    socket.addEventListener('open', () => {
      resolve({
        exceptions,
        send(method, params = {}) {
          return new Promise((resolveCommand, rejectCommand) => {
            const id = nextId
            nextId += 1
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand })
            socket.send(JSON.stringify({ id, method, params }))
          })
        },
        close() {
          socket.close()
        },
      })
    }, { once: true })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const command = pending.get(message.id)
        if (!command) {
          return
        }
        pending.delete(message.id)
        if (message.error) {
          command.reject(new Error(message.error.message))
        } else {
          command.resolve(message.result)
        }
        return
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params?.exceptionDetails
        exceptions.push(
          details?.exception?.description ?? details?.text ?? 'Unknown page exception',
        )
      }
    })
    socket.addEventListener('error', () => {
      reject(new Error('Could not connect to Chrome DevTools'))
    }, { once: true })
    socket.addEventListener('close', () => {
      for (const command of pending.values()) {
        command.reject(new Error('Chrome DevTools connection closed'))
      }
      pending.clear()
    })
  })
}

async function readSmokeSnapshot(devTools) {
  const evaluation = await devTools.send('Runtime.evaluate', {
    expression: `(() => {
      const body = document.body
      return {
        readyState: document.readyState,
        status: body?.dataset.smokeStatus ?? null,
        phase: body?.dataset.smokePhase ?? null,
        error: body?.dataset.smokeError ?? null,
        highDensityMilliseconds: body?.dataset.highDensityInitMs ?? null,
        highDensityTriangles: body?.dataset.highDensityTriangles ?? null,
        maximumLongTaskMilliseconds:
          body?.dataset.highDensityMaxLongTaskMs ?? null,
        realModel: ['passed', 'failed'].includes(body?.dataset.smokeStatus)
          ? JSON.parse(document.getElementById('customforge-real-model-evidence')?.textContent ?? 'null')
          : null,
        editorView: ['passed', 'failed'].includes(body?.dataset.smokeStatus)
          ? JSON.parse(document.getElementById('customforge-editor-view-evidence')?.textContent ?? 'null') : null,
        input: JSON.parse(body?.dataset.viewportInput ?? 'null'),
        domTail: document.documentElement?.outerHTML.slice(-4000) ?? '',
      }
    })()`,
    returnByValue: true,
  })
  return evaluation.result?.value
}

async function waitForSmokeResult(devTools, browser, getStderr) {
  const deadline = Date.now() + smokeTimeoutMs
  let latestSnapshot
  let lastInputId

  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Browser exited during smoke test\n${getStderr()}`)
    }
    try {
      latestSnapshot = await readSmokeSnapshot(devTools)
      const input = latestSnapshot?.input
      if (input && input.id !== lastInputId) {
        lastInputId = input.id
        if (input.kind === 'metrics') {
          // CDP 单独修改 DPR 不发送平台 resolution/resize 事件，同时改变并恢复布局宽度模拟浏览器缩放
          await devTools.send('Emulation.setDeviceMetricsOverride', { width: input.width + 1, height: input.height, deviceScaleFactor: input.dpr, mobile: false })
          await devTools.send('Emulation.setDeviceMetricsOverride', { width: input.width, height: input.height, deviceScaleFactor: input.dpr, mobile: false })
        } else if (input.kind === 'capture') {
          if (process.env.CUSTOMFORGE_SMOKE_EVIDENCE) {
            await mkdir(process.env.CUSTOMFORGE_SMOKE_EVIDENCE, { recursive: true })
            const screenshot = await devTools.send('Page.captureScreenshot', { format: 'png' })
            await writeFile(join(process.env.CUSTOMFORGE_SMOKE_EVIDENCE, `${input.name}-${input.id}.png`), Buffer.from(screenshot.data, 'base64'))
          }
        } else {
          const [from, to] = input.points
          if (input.kind === 'touch') {
            await devTools.send('Emulation.setTouchEmulationEnabled', { enabled: true })
            await devTools.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 0 }] })
          } else {
            await devTools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from })
            await devTools.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', clickCount: 1, modifiers: input.modifiers ?? 0 })
          }
          for (let i = 1; i <= 8; i++) {
            const point = { x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }
            if (input.kind === 'touch') await devTools.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 0 }] })
            else await devTools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, buttons: 1, modifiers: input.modifiers ?? 0 })
          }
          if (input.kind === 'touch') {
            await devTools.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
            await devTools.send('Emulation.setTouchEmulationEnabled', { enabled: false })
          } else await devTools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', clickCount: 1, modifiers: input.modifiers ?? 0 })
        }
        await devTools.send('Runtime.evaluate', { expression: `document.body.dataset.viewportInputDone = ${JSON.stringify(input.id)}` })
      }
      if (['passed', 'failed'].includes(latestSnapshot?.status)) {
        return latestSnapshot
      }
    } catch (error) {
      if (!error.message.includes('context')) {
        throw error
      }
    }
    await delay(100)
  }

  return {
    ...latestSnapshot,
    status: 'timed-out',
    error: `No final smoke result after ${smokeTimeoutMs}ms`,
  }
}

async function runBrowser(browser, profileDirectory, url, windowSize) {
  const [width, height] = windowSize.split(',').map(Number)
  const child = spawn(browser, [
    '--headless=new',
    '--no-sandbox',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-sync',
    '--enable-unsafe-swiftshader',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    `--window-size=${windowSize}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  let launchError
  let devTools

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.once('error', (error) => { launchError = error })

  try {
    const port = await waitForDevToolsPort(child, profileDirectory, () => stderr)
    if (launchError) {
      throw launchError
    }
    const pageTarget = await waitForPageTarget(port, child, () => stderr)
    devTools = await connectToDevTools(pageTarget)
    await devTools.send('Runtime.enable')
    await devTools.send('Page.enable')
    if (baselineDirectory) {
      await devTools.send('Network.enable')
      await devTools.send('Network.setCacheDisabled', { cacheDisabled: true })
    }
    await devTools.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await devTools.send('Page.navigate', { url })
    const snapshot = await waitForSmokeResult(devTools, child, () => stderr)
    return { snapshot, stdout, stderr, exceptions: devTools.exceptions }
  } finally {
    devTools?.close()
    if (child.exitCode === null) {
      child.kill()
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(5_000),
      ])
    }
  }
}

function outputTail(output, maximumLength = 4000) {
  const normalized = output.trim()
  return normalized.length > maximumLength
    ? `...${normalized.slice(-maximumLength)}`
    : normalized
}

function browserErrorTail(stderr) {
  return outputTail(
    stderr
      .split(/\r?\n/)
      .filter((line) => !line.includes('DEPRECATED_ENDPOINT'))
      .join('\n'),
  )
}

function assertSmokePassed(result, viewport, viteOutput) {
  if (result.snapshot?.status !== 'passed') {
    const details = [
      `Smoke status: ${result.snapshot?.status ?? 'missing'}`,
      `Smoke phase: ${result.snapshot?.phase ?? 'missing'}`,
      `Smoke error: ${result.snapshot?.error ?? 'missing'}`,
      `Page exceptions:\n${outputTail(result.exceptions.join('\n')) || '(empty)'}`,
      `DOM output tail:\n${result.snapshot?.domTail || '(empty)'}`,
      `Browser error tail:\n${browserErrorTail(result.stderr) || '(empty)'}`,
      `Vite output:\n${outputTail(viteOutput) || '(empty)'}`,
    ]
    throw new Error(
      `${viewport} browser smoke test did not report success\n${details.join('\n\n')}`,
    )
  }
}

async function saveRealModelEvidence(snapshot, viewport) {
  if (!realModelPath) return
  if (!snapshot.realModel) throw new Error('Real-model smoke test produced no evidence')
  const directory = process.env.CUSTOMFORGE_SMOKE_ARTIFACT_DIR
  if (directory) {
    await mkdir(directory, { recursive: true })
    for (const [name, dataUrl] of Object.entries(snapshot.realModel.images)) {
      await writeFile(join(directory, `${viewport}-${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))
    }
    await writeFile(join(directory, `${viewport}-real-model.json`), JSON.stringify({ sha256: realModelRevision, cases: snapshot.realModel.cases, benchmark: snapshot.realModel.benchmark }, null, 2))
  }
  console.log(`${viewport} real-model mapping verified (${realModelRevision}; ${snapshot.realModel.cases.length} original/fit/direction cases)`)
}

async function saveEditorViewEvidence(snapshot, viewport) {
  if (!snapshot.editorView?.cases?.length) throw new Error('Editor viewport contract evidence is missing')
  const directory = process.env.CUSTOMFORGE_SMOKE_EVIDENCE
  if (directory) {
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, `${viewport}-editor-view.json`), JSON.stringify(snapshot.editorView, null, 2))
  }
}

await access(viteEntry)
await assertInstalledPackageIsFresh()
const browser = await findBrowser()
const profileDirectory = await mkdtemp(join(tmpdir(), 'customforge-smoke-'))
let serverOutput = ''
const server = spawn(process.execPath, [
  viteEntry,
  '--host',
  '127.0.0.1',
  '--port',
  String(smokePort),
  '--strictPort',
  '--config',
  join(consumerRoot, 'vite.smoke.config.mjs'),
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
  const desktopResult = await runBrowser(
    browser,
    join(profileDirectory, 'desktop'),
    desktopSmokeUrl,
    '1440,900',
  )
  assertSmokePassed(desktopResult, 'Desktop', serverOutput)
  await saveEditorViewEvidence(desktopResult.snapshot, 'desktop')
  await saveRealModelEvidence(desktopResult.snapshot, 'desktop')
  const mobileResult = await runBrowser(
    browser,
    join(profileDirectory, 'mobile'),
    mobileSmokeUrl,
    '390,844',
  )
  assertSmokePassed(mobileResult, 'Mobile', serverOutput)
  await saveEditorViewEvidence(mobileResult.snapshot, 'mobile')
  await saveRealModelEvidence(mobileResult.snapshot, 'mobile')
  const highDensityMilliseconds =
    desktopResult.snapshot.highDensityMilliseconds
  const highDensityTriangles = desktopResult.snapshot.highDensityTriangles
  const maximumLongTaskMilliseconds =
    desktopResult.snapshot.maximumLongTaskMilliseconds
  if (
    !highDensityMilliseconds ||
    !highDensityTriangles ||
    !maximumLongTaskMilliseconds
  ) {
    throw new Error('Browser smoke test did not report high-density timing')
  }
  console.log(
    `Browser smoke test passed at desktop and mobile sizes (${highDensityTriangles} UV triangles initialized in ${highDensityMilliseconds}ms; maximum Long Task ${maximumLongTaskMilliseconds}ms)`,
  )
} finally {
  if (server.exitCode === null) {
    server.kill()
  }
  await rm(profileDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 })
}
