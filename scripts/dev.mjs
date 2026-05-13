import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'
const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGHUP']
const rootDir = fileURLToPath(new URL('..', import.meta.url))
const backendDir = fileURLToPath(new URL('../backend', import.meta.url))

let frontendStarted = false
let stopping = false
let frontendChild = null
let backendChild = null

function startProcess(name, args, cwd) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    detached: !isWindows,
  })

  child.on('exit', (code, signal) => {
    if (stopping) {
      return
    }

    console.log(`[dev] ${name} exited (${signal ?? code ?? 0})`)
    shutdown(code ?? 0)
  })

  child.on('error', (error) => {
    console.error(`[dev] failed to start ${name}:`, error)
    shutdown(1)
  })

  return child
}

function isProcessAlive(child) {
  return Boolean(child && !child.killed && child.exitCode === null)
}

function stopChild(child) {
  if (!isProcessAlive(child)) {
    return
  }

  if (isWindows) {
    child.kill('SIGTERM')
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

function shutdown(code = 0) {
  if (stopping) {
    return
  }

  stopping = true
  stopChild(frontendChild)
  stopChild(backendChild)
  setTimeout(() => process.exit(code), 150)
}

function checkPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`port ${port} is already in use on ${host}`))
        return
      }

      reject(error)
    })

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolve()
      })
    })

    server.listen(port, host)
  })
}

async function checkDevPortsAvailable() {
  for (const port of [3000, 3001]) {
    await checkPortAvailable(port, '127.0.0.1')
    await checkPortAvailable(port, '::')
  }
}

async function waitForBackend(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!isProcessAlive(backendChild)) {
      throw new Error('backend exited before it became ready')
    }

    try {
      const res = await fetch(url)
      if (res.ok) {
        return
      }
    } catch {
      // Backend is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`backend was not ready within ${timeoutMs / 1000}s`)
}

function startFrontend() {
  if (frontendStarted) {
    return
  }

  frontendStarted = true
  console.log('[dev] backend is ready, starting frontend')
  frontendChild = startProcess('frontend', ['run', 'dev:frontend'], rootDir)
}

async function main() {
  await checkDevPortsAvailable()

  console.log('[dev] starting backend')
  backendChild = startProcess('backend', ['run', 'dev'], backendDir)

  for (const signal of shutdownSignals) {
    process.on(signal, () => shutdown(0))
  }

  await waitForBackend('http://127.0.0.1:3001/api/health')
  startFrontend()
}

main().catch((error) => {
  console.error(`[dev] ${error.message}`)
  shutdown(1)
})
