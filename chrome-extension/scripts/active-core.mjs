import { createHash } from 'node:crypto'
import { join, win32 } from 'node:path'

/** The user's existing Core is outside the isolated project dev HOME. */
export function hostCoreSocket(hostHome, platform = process.platform) {
  if (!hostHome?.trim()) return undefined
  if (platform === 'win32') {
    const identity = createHash('sha256').update(win32.resolve(hostHome).toLowerCase()).digest('hex').slice(0, 16)
    return `\\\\.\\pipe\\agent-helm-${identity}`
  }
  return join(hostHome, '.agent-helm', 'run', 'daemon.sock')
}

/** Prefer the active dev Core, then a compatible Host Core; never infer ownership from an HTTP port. */
export async function selectActiveCoreBridge(devBridge, { explicitSocket, hostSocket, createBridge }) {
  const probe = await devBridge.request('probe')
  if (probe?.connected) return { bridge: devBridge, connected: true, socket: probe.socket }
  if (probe?.reason !== 'not-running') {
    throw new Error(probe?.error ?? `Cannot attach to Agent Helm Core: ${JSON.stringify(probe)}`)
  }
  if (!explicitSocket && hostSocket && hostSocket !== probe.socket) {
    const hostBridge = createBridge(hostSocket)
    let selected = false
    try {
      const hostProbe = await hostBridge.request('probe')
      if (hostProbe?.connected) {
        selected = true
        devBridge.stop()
        return { bridge: hostBridge, connected: true, socket: hostProbe.socket }
      }
      if (hostProbe?.reason !== 'not-running') {
        throw new Error(hostProbe?.error ?? `Cannot attach to existing Host Core: ${JSON.stringify(hostProbe)}`)
      }
    } finally {
      // Keep only a validated, connected Host bridge; never kill the active Core.
      // A failed fallback bridge is only a client process.
      if (!selected) hostBridge.stop()
    }
  }
  return { bridge: devBridge, connected: false, socket: probe.socket }
}
