import assert from 'node:assert/strict'
import { test } from 'vitest'
import { hostCoreSocket, selectActiveCoreBridge } from './active-core.mjs'

function bridge(socket, probe) {
  return {
    socket, stopped: false, calls: [],
    async request(method) { this.calls.push(method); if (probe instanceof Error) throw probe; return { socket, ...probe } },
    stop() { this.stopped = true },
  }
}

test('host default Core socket uses the Host HOME, not isolated dev HOME', () => {
  assert.equal(hostCoreSocket('/Users/example'), '/Users/example/.agent-helm/run/daemon.sock')
  assert.equal(hostCoreSocket(''), undefined)
  assert.match(hostCoreSocket('C:\\Users\\example', 'win32'), /^\\\\\.\\pipe\\agent-helm-[0-9a-f]{16}$/)
})

test('an active dev Core takes precedence over Host Core and remains untouched', async () => {
  const dev = bridge('/dev.sock', { connected: true, reason: 'connected' })
  const chosen = await selectActiveCoreBridge(dev, { hostSocket: '/host.sock', createBridge() { throw new Error('must not open Host') } })
  assert.equal(chosen.bridge, dev)
  assert.equal(chosen.connected, true)
  assert.equal(dev.stopped, false)
})

test('a missing dev Core attaches to the running Host Core without spawning or stopping it', async () => {
  const dev = bridge('/dev.sock', { connected: false, reason: 'not-running' })
  const host = bridge('/host.sock', { connected: true, reason: 'connected' })
  const chosen = await selectActiveCoreBridge(dev, { hostSocket: '/host.sock', createBridge: (path) => { assert.equal(path, '/host.sock'); return host } })
  assert.equal(chosen.bridge, host)
  assert.equal(chosen.connected, true)
  assert.equal(dev.stopped, true)
  assert.equal(host.stopped, false)
  assert.deepEqual(host.calls, ['probe'])
})

test('an explicit Socket never falls back to the default Host socket', async () => {
  const dev = bridge('/explicit.sock', { connected: false, reason: 'not-running' })
  const chosen = await selectActiveCoreBridge(dev, { explicitSocket: '/explicit.sock', hostSocket: '/host.sock', createBridge() { throw new Error('must not probe Host') } })
  assert.equal(chosen.connected, false)
  assert.equal(chosen.bridge, dev)
})

test('neither Core available: close the temporary Host client and allow managed dev startup', async () => {
  const dev = bridge('/dev.sock', { connected: false, reason: 'not-running' })
  const host = bridge('/host.sock', { connected: false, reason: 'not-running' })
  const chosen = await selectActiveCoreBridge(dev, { hostSocket: '/host.sock', createBridge: () => host })
  assert.equal(chosen.connected, false)
  assert.equal(chosen.bridge, dev)
  assert.equal(host.stopped, true)
  assert.equal(dev.stopped, false)
})

test('an incompatible dev or Host Core is not replaced by another Core', async () => {
  const dev = bridge('/dev.sock', { connected: false, reason: 'incompatible-daemon', error: 'incompatible dev' })
  await assert.rejects(selectActiveCoreBridge(dev, { hostSocket: '/host.sock', createBridge() { throw new Error('must not probe Host') } }), /incompatible dev/)
  const missing = bridge('/dev.sock', { connected: false, reason: 'not-running' })
  const host = bridge('/host.sock', { connected: false, reason: 'incompatible-daemon', error: 'incompatible Host' })
  await assert.rejects(selectActiveCoreBridge(missing, { hostSocket: '/host.sock', createBridge: () => host }), /incompatible Host/)
  assert.equal(host.stopped, true)
})
