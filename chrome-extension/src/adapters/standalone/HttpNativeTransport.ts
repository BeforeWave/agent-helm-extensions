import { t } from '../../locale'
import type { ConnectionStatus } from '../../models/controlPlane'
import type { NativeControlTransport, NativeDaemonProbe } from '../chrome/NativeMessagingTransport'

interface NativeBridgeResponse<T> {
  result?: T
  error?: string
}

export class HttpNativeTransport implements NativeControlTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {}

  async request<T>(method: string, params: unknown[] = [], timeoutMs: number | null = 5_000): Promise<T> {
    const controller = timeoutMs === null ? undefined : new AbortController()
    const timer = controller && timeoutMs !== null
      ? setTimeout(() => controller.abort(new Error(`Standalone bridge request timed out after ${String(timeoutMs)}ms: ${method}`)), timeoutMs)
      : undefined
    try {
      const response = await fetch(`${this.baseUrl}/api/native`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-agent-helm-standalone-token': this.accessToken,
        },
        body: JSON.stringify({ method, params }),
        ...(controller ? { signal: controller.signal } : {}),
      })
      const payload = await response.json() as NativeBridgeResponse<T>
      if (!response.ok || payload.error) throw new Error(payload.error || `Standalone bridge HTTP ${String(response.status)}`)
      return payload.result as T
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async daemonProbe(): Promise<NativeDaemonProbe> {
    return await this.request<NativeDaemonProbe>('probe', [], 4_000)
  }

  async probe(): Promise<ConnectionStatus> {
    try {
      const probe = await this.daemonProbe()
      if (probe.connected) return { state: 'connected' }
      if (probe.reason === 'not-running') return { state: 'unavailable', message: t('extensionServiceNoResponse') }
      return { state: 'unavailable', message: probe.error || t('extensionNativeConnectionFailed') }
    } catch {
      return { state: 'unavailable', message: t('extensionNativeConnectionFailed') }
    }
  }
}
