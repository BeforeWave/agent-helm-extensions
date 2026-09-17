#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageName = 'agent-helm-chrome-extension'
const localBuildDependencies = ['@beforewave/agent-helm']
const MAX_BODY_BYTES = 1_048_576
const MAX_NATIVE_MESSAGE_BYTES = 8 * 1024 * 1024

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')) }

function findWorkspaceRoot() {
  let current = dirname(packageRoot)
  for (;;) {
    const manifestFile = join(current, 'package.json')
    if (existsSync(manifestFile)) {
      const manifest = readJson(manifestFile)
      const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : []
      const containsPackage = workspaces.some((workspace) => !workspace.includes('*') && resolve(current, workspace) === packageRoot)
      if (containsPackage && manifest.name !== packageName) return current
    }
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function runNpm(args, cwd) {
  console.log(`▶ npm ${args.join(' ')}`)
  execFileSync('npm', args, { cwd, stdio: 'inherit' })
}

function buildStandalone() {
  const workspaceRoot = findWorkspaceRoot()
  if (workspaceRoot) {
    for (const dependency of localBuildDependencies) runNpm(['run', 'build', '-w', dependency], workspaceRoot)
    runNpm(['run', 'build:standalone', '-w', packageName], workspaceRoot)
    return { workspaceRoot, coreCli: join(workspaceRoot, 'packages', 'agent-helm', 'lib', 'cli.js') }
  }
  runNpm(['run', 'build:standalone'], packageRoot)
  const coreManifest = import.meta.resolve('@beforewave/agent-helm/package.json')
  return { workspaceRoot: undefined, coreCli: fileURLToPath(new URL('./lib/cli.js', coreManifest)) }
}

function parseArgs(argv) {
  const options = { host: '127.0.0.1', port: 3462, daemonMode: 'auto', daemonSocket: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--host') options.host = argv[++i]
    else if (arg === '--port') options.port = Number.parseInt(argv[++i], 10)
    else if (arg === '--daemon-mode') options.daemonMode = argv[++i]
    else if (arg === '--daemon-socket') options.daemonSocket = argv[++i]
    else if (arg === '-h' || arg === '--help') options.help = true
    else throw new Error(`unknown option: ${arg}`)
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('--port must be an integer from 0 to 65535')
  if (!['auto', 'external', 'managed'].includes(options.daemonMode)) throw new Error('--daemon-mode must be auto, external, or managed')
  return options
}

function usage() {
  return `Usage: npm run standalone:chrome-ui -- [options]\n\nOptions:\n  --host <host>             standalone UI bind host (default: 127.0.0.1)\n  --port <port>             standalone UI port (default: 3462; 0 = random)\n  --daemon-mode <mode>      Agent Helm daemon mode: auto, external, or managed (default: auto)\n  --daemon-socket <path>    Agent Helm daemon socket override\n  -h, --help                show help\n`
}

class NativeHostBridge {
  constructor(coreCli, daemonSocket) {
    const env = { ...process.env, ...(daemonSocket ? { AGENT_HELM_DAEMON_SOCKET: daemonSocket } : {}) }
    this.child = spawn(process.execPath, [coreCli, 'chrome-native-host'], { cwd: packageRoot, env, stdio: ['pipe', 'pipe', 'inherit'] })
    this.buffer = Buffer.alloc(0)
    this.pending = new Map()
    this.closed = false
    this.child.stdout.on('data', (chunk) => this.#consume(chunk))
    this.child.once('error', (error) => this.#fail(error))
    this.child.once('exit', (code, signal) => this.#fail(new Error(`chrome native host exited (${code ?? signal ?? 'unknown'})`)))
  }

  #consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      if (this.buffer.length < 4) return
      const length = this.buffer.readUInt32LE(0)
      if (length <= 0 || length > MAX_NATIVE_MESSAGE_BYTES) return this.#fail(new Error(`invalid native host message length: ${length}`))
      if (this.buffer.length < 4 + length) return
      const payload = this.buffer.subarray(4, 4 + length)
      this.buffer = this.buffer.subarray(4 + length)
      let message
      try { message = JSON.parse(payload.toString('utf8')) } catch (error) { return this.#fail(error) }
      const pending = typeof message?.id === 'string' ? this.pending.get(message.id) : undefined
      if (!pending) continue
      this.pending.delete(message.id)
      if (typeof message.error === 'string' && message.error) pending.reject(new Error(message.error))
      else pending.resolve(message.result)
    }
  }

  #fail(error) {
    if (this.closed) return
    this.closed = true
    for (const pending of this.pending.values()) pending.reject(error instanceof Error ? error : new Error(String(error)))
    this.pending.clear()
  }

  request(method, params = []) {
    if (this.closed || !this.child.stdin.writable) return Promise.reject(new Error('chrome native host bridge is unavailable'))
    const id = randomUUID()
    const payload = Buffer.from(JSON.stringify({ id, method, params }), 'utf8')
    const header = Buffer.allocUnsafe(4)
    header.writeUInt32LE(payload.length, 0)
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.child.stdin.write(Buffer.concat([header, payload]), (error) => {
        if (!error) return
        if (this.pending.delete(id)) reject(error)
      })
    })
  }

  stop() {
    if (this.closed) return
    this.#fail(new Error('chrome native host bridge stopped'))
    try { this.child.stdin.end() } catch {}
    if (this.child.exitCode === null) this.child.kill('SIGTERM')
  }
}

function spawnManagedCore(coreCli, daemonSocket) {
  const env = { ...process.env, ...(daemonSocket ? { AGENT_HELM_DAEMON_SOCKET: daemonSocket } : {}) }
  return spawn(process.execPath, [coreCli, 'start', '--foreground'], { cwd: packageRoot, env, stdio: 'inherit' })
}

async function waitForProbe(bridge, deadlineMs = 20_000) {
  const deadline = Date.now() + deadlineMs
  let last
  while (Date.now() < deadline) {
    try {
      last = await bridge.request('probe')
      if (last?.connected) return last
    } catch (error) { last = { error: error instanceof Error ? error.message : String(error) } }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
  }
  throw new Error(`Agent Helm Core did not become ready: ${JSON.stringify(last)}`)
}

function contentType(file) {
  switch (extname(file)) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.json': return 'application/json; charset=utf-8'
    default: return 'application/octet-stream'
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function startServer({ host, port, token, bridge, assetRoot }) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host || `${host}:${port}`}`)
      if (url.pathname === '/api/native') {
        if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); return res.end() }
        if (req.headers['x-agent-helm-standalone-token'] !== token) { res.writeHead(401); return res.end() }
        const body = JSON.parse(await readBody(req))
        if (!body || typeof body.method !== 'string' || !Array.isArray(body.params)) throw new Error('invalid native request')
        try {
          const result = await bridge.request(body.method, body.params)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          return res.end(JSON.stringify({ result }))
        } catch (error) {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
        }
      }

      const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const target = resolve(assetRoot, normalize(requested))
      const prefix = assetRoot.endsWith(sep) ? assetRoot : `${assetRoot}${sep}`
      let file = target
      if (target !== join(assetRoot, 'index.html') && !target.startsWith(prefix)) { res.writeHead(404); return res.end() }
      if (!existsSync(file) || !statSync(file).isFile()) file = join(assetRoot, 'index.html')
      res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' })
      res.end(readFileSync(file))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(error instanceof Error ? error.message : String(error))
    }
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolvePromise)
  })
  return server
}

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  process.stdout.write(usage())
  process.exit(0)
}

let bridge
let managedCore
let server
try {
  const { coreCli } = buildStandalone()
  if (!existsSync(coreCli)) throw new Error(`Agent Helm Core CLI is missing: ${coreCli}`)
  bridge = new NativeHostBridge(coreCli, options.daemonSocket)

  if (options.daemonMode === 'managed') {
    managedCore = spawnManagedCore(coreCli, options.daemonSocket)
    await waitForProbe(bridge)
  } else if (options.daemonMode === 'auto') {
    const probe = await bridge.request('probe').catch(() => ({ connected: false }))
    if (!probe?.connected) {
      managedCore = spawnManagedCore(coreCli, options.daemonSocket)
      await waitForProbe(bridge)
    }
  }

  const token = randomBytes(24).toString('base64url')
  const assetRoot = join(packageRoot, 'lib', 'standalone')
  server = await startServer({ host: options.host, port: options.port, token, bridge, assetRoot })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('standalone server did not expose a TCP address')
  const url = `http://${options.host}:${address.port}/#token=${encodeURIComponent(token)}`
  process.stdout.write(`\nAgent Helm Chrome standalone UI:\n${url}\n\n`)

  const shutdown = () => {
    server?.close()
    bridge?.stop()
    if (managedCore?.exitCode === null) managedCore.kill('SIGTERM')
  }
  process.once('SIGINT', () => { shutdown(); process.exitCode = 130 })
  process.once('SIGTERM', () => { shutdown(); process.exitCode = 143 })
  await new Promise((resolvePromise) => server.once('close', resolvePromise))
} catch (error) {
  bridge?.stop()
  if (managedCore?.exitCode === null) managedCore.kill('SIGTERM')
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
