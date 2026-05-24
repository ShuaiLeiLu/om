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
let backendPort = 3001

function startProcess(name, args, cwd, extraEnv = {}) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
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
  await checkPortAvailable(3000, '127.0.0.1')
  await checkPortAvailable(3000, '::')
}

async function findAvailablePort(startPort, attempts = 20) {
  for (let port = startPort; port < startPort + attempts; port += 1) {
    try {
      await checkPortAvailable(port, '127.0.0.1')
      await checkPortAvailable(port, '::')
      return port
    } catch {}
  }

  throw new Error(`no available backend port found from ${startPort} to ${startPort + attempts - 1}`)
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
  console.log(`[dev] backend is ready on ${backendPort}, starting frontend`)
  frontendChild = startProcess('frontend', ['run', 'dev:frontend'], rootDir, {
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${backendPort}`
  })
}

async function main() {
  await checkDevPortsAvailable()
  backendPort = await findAvailablePort(Number(process.env.PORT || 3001))

  console.log(`[dev] starting backend on ${backendPort}`)
  backendChild = startProcess('backend', ['run', 'dev'], backendDir, {
    PORT: String(backendPort)
  })

  for (const signal of shutdownSignals) {
    process.on(signal, () => shutdown(0))
  }

  await waitForBackend(`http://127.0.0.1:${backendPort}/api/health`)
  startFrontend()
}

main().catch((error) => {
  console.error(`[dev] ${error.message}`)
  shutdown(1)
})
