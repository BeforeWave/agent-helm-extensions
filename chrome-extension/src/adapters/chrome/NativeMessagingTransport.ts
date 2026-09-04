import { t } from '../../locale'
import type { ConnectionStatus } from '../../models/controlPlane'

export interface NativeDaemonProbe {
  connected: boolean
  managed: boolean
  socket: string
  reason: 'connected' | 'not-running' | 'incompatible-daemon' | 'attach-failed'
  error?: string
}

export class NativeMessagingTransport {
  #port: chrome.runtime.Port | undefined
  readonly #pending = new Map<string, {
    resolve(value: unknown): void
    reject(error: Error): void
    timer?: ReturnType<typeof setTimeout>
  }>()

  constructor(private readonly hostName: string) {}

  #nativeError(message?: string): Error {
    return new Error(message?.trim() || t('extensionNativeMessagingUnavailable'))
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.#pending.clear()
  }

  #ensurePort(): chrome.runtime.Port {
    if (!this.hostName.trim()) throw this.#nativeError(t('extensionNativeHostNotConfigured'))
    if (!chrome.runtime?.connectNative) throw this.#nativeError(t('extensionNativeMessagingUnavailable'))
    if (this.#port) return this.#port

    const port = chrome.runtime.connectNative(this.hostName)
    this.#port = port
    port.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return
      const response = message as { id?: unknown; result?: unknown; error?: unknown }
      if (typeof response.id !== 'string') return
      const pending = this.#pending.get(response.id)
      if (!pending) return
      this.#pending.delete(response.id)
      clearTimeout(pending.timer)
      if (typeof response.error === 'string' && response.error) pending.reject(new Error(response.error))
      else pending.resolve(response.result)
    })
    port.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message
      if (this.#port === port) this.#port = undefined
      this.#rejectPending(this.#nativeError(message))
    })
    return port
  }

  async request<T>(method: string, params: unknown[] = [], timeoutMs: number | null = 5_000): Promise<T> {
    const port = this.#ensurePort()
    const id = globalThis.crypto.randomUUID()
    return await new Promise<T>((resolve, reject) => {
      const timer = timeoutMs === null ? undefined : setTimeout(() => {
        if (!this.#pending.delete(id)) return
        const timeoutError = new Error(`Native Messaging request timed out after ${String(timeoutMs)}ms: ${method}`)
        if (this.#port === port) this.#port = undefined
        try { port.disconnect() } catch {}
        this.#rejectPending(timeoutError)
        reject(timeoutError)
      }, timeoutMs)
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        ...(timer === undefined ? {} : { timer }),
      })
      try {
        port.postMessage({ id, method, params })
      } catch (error) {
        if (this.#pending.delete(id)) clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  async daemonProbe(): Promise<NativeDaemonProbe> {
    return await this.request<NativeDaemonProbe>('probe', [], 4_000)
  }

  async probe(): Promise<ConnectionStatus> {
    if (!this.hostName.trim()) {
      return { state: 'install-required', message: t('extensionNativeHostNotConfigured') }
    }
    if (!chrome.runtime?.connectNative) {
      return { state: 'unavailable', message: t('extensionNativeMessagingUnavailable') }
    }
    try {
      await this.daemonProbe()
      // A successful Native Messaging round trip means the local Agent Helm host is installed.
      // The daemon may still be stopped; Service state owns that distinction.
      return { state: 'connected' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const installRequired = /native messaging host.*not found|specified native messaging host not found|host not found|not registered|specified native messaging host.*forbidden/i.test(message)
      return {
        state: installRequired ? 'install-required' : 'unavailable',
        message: installRequired ? t('extensionNativeHostNotConfigured') : t('extensionNativeConnectionFailed'),
      }
    }
  }
}
