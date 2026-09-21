import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = new URL('../', import.meta.url)
const examples = ['npm-consumer', 'api-contract-consumer']

function runPnpm(args, cwd) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(
        `pnpm ${args.join(' ')} failed with ${signal ?? `exit code ${code}`}`,
      ))
    })
  })
}

for (const example of examples) {
  const cwd = fileURLToPath(new URL(`examples/${example}/`, projectRoot))
  console.log(`Verifying independent consumer: ${example}`)
  await runPnpm([
    'install',
    '--ignore-workspace',
    '--lockfile=false',
    '--ignore-scripts',
  ], cwd)
  await runPnpm(['check'], cwd)
  await runPnpm(['build'], cwd)
}

console.log('Independent npm consumers verified')
