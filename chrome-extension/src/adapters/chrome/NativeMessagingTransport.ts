import { t } from '../../locale'
import type { ConnectionStatus } from '../../models/controlPlane'

export interface NativeDaemonProbe {
  connected: boolean
  managed: boolean
  socket: string
  reason: 'connected' | 'not-running' | 'incompatible-daemon' | 'attach-failed'
  error?: string
}

export interface NativeControlTransport {
  request<T>(method: string, params?: unknown[], timeoutMs?: number | null): Promise<T>
  daemonProbe(): Promise<NativeDaemonProbe>
  probe(): Promise<ConnectionStatus>
  subscribeWorkHistoryChanges?(listener: () => void): () => void
}

type NativeResponseChunk = {
  index: number
  total: number
  data: string
}

type NativeResponseEnvelope = {
  id?: unknown
  result?: unknown
  error?: unknown
  chunk?: unknown
  event?: unknown
}

type PendingNativeRequest = {
  resolve(value: unknown): void
  reject(error: Error): void
  timer?: ReturnType<typeof setTimeout>
  chunks?: {
    total: number
    parts: Map<number, string>
  }
}

function parseNativeResponseChunk(value: unknown): NativeResponseChunk | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const chunk = value as { index?: unknown; total?: unknown; data?: unknown }
  if (!Number.isInteger(chunk.index) || !Number.isInteger(chunk.total) || typeof chunk.data !== 'string') return undefined
  const index = chunk.index as number
  const total = chunk.total as number
  if (index < 0 || total < 1 || index >= total) return undefined
  return { index, total, data: chunk.data }
}

function decodeChunkedNativeResponse(parts: Map<number, string>, total: number): NativeResponseEnvelope {
  const decoded = Array.from({ length: total }, (_, index) => {
    const encoded = parts.get(index)
    if (encoded === undefined) throw new Error(`Native Messaging response chunk ${String(index)} is missing`)
    const binary = globalThis.atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let offset = 0; offset < binary.length; offset += 1) bytes[offset] = binary.charCodeAt(offset)
    return bytes
  })
  const byteLength = decoded.reduce((sum, bytes) => sum + bytes.byteLength, 0)
  const combined = new Uint8Array(byteLength)
  let offset = 0
  for (const bytes of decoded) {
    combined.set(bytes, offset)
    offset += bytes.byteLength
  }
  return JSON.parse(new TextDecoder().decode(combined)) as NativeResponseEnvelope
}

export class NativeMessagingTransport implements NativeControlTransport {
  #port: chrome.runtime.Port | undefined
  readonly #pending = new Map<string, PendingNativeRequest>()
  readonly #workHistoryListeners = new Set<() => void>()

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

  #settleResponse(response: NativeResponseEnvelope): void {
    if (typeof response.id !== 'string') return
    const pending = this.#pending.get(response.id)
    if (!pending) return
    this.#pending.delete(response.id)
    clearTimeout(pending.timer)
    if (typeof response.error === 'string' && response.error) pending.reject(new Error(response.error))
    else pending.resolve(response.result)
  }

  #acceptChunk(response: NativeResponseEnvelope, pending: PendingNativeRequest, chunk: NativeResponseChunk): void {
    if (typeof response.id !== 'string') return
    if (!pending.chunks) pending.chunks = { total: chunk.total, parts: new Map() }
    if (pending.chunks.total !== chunk.total) {
      this.#pending.delete(response.id)
      clearTimeout(pending.timer)
      pending.reject(new Error('Native Messaging response chunk count changed during transfer'))
      return
    }
    pending.chunks.parts.set(chunk.index, chunk.data)
    if (pending.chunks.parts.size !== pending.chunks.total) return
    try {
      const complete = decodeChunkedNativeResponse(pending.chunks.parts, pending.chunks.total)
      if (complete.id !== response.id) throw new Error('Native Messaging chunked response id mismatch')
      this.#settleResponse(complete)
    } catch (error) {
      this.#pending.delete(response.id)
      clearTimeout(pending.timer)
      pending.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  #ensurePort(): chrome.runtime.Port {
    if (!this.hostName.trim()) throw this.#nativeError(t('extensionNativeHostNotConfigured'))
    if (!chrome.runtime?.connectNative) throw this.#nativeError(t('extensionNativeMessagingUnavailable'))
    if (this.#port) return this.#port

    const port = chrome.runtime.connectNative(this.hostName)
    this.#port = port
    port.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return
      const response = message as NativeResponseEnvelope
      if (response.event === 'work-history-changed') {
        for (const listener of [...this.#workHistoryListeners]) listener()
        return
      }
      if (typeof response.id !== 'string') return
      const pending = this.#pending.get(response.id)
      if (!pending) return
      if (response.chunk !== undefined) {
        const chunk = parseNativeResponseChunk(response.chunk)
        if (!chunk) {
          this.#pending.delete(response.id)
          clearTimeout(pending.timer)
          pending.reject(new Error('Invalid Native Messaging response chunk'))
          return
        }
        this.#acceptChunk(response, pending, chunk)
        return
      }
      this.#settleResponse(response)
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
        reject(new Error(`Native Messaging request timed out after ${String(timeoutMs)}ms: ${method}`))
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

  subscribeWorkHistoryChanges(listener: () => void): () => void {
    this.#workHistoryListeners.add(listener)
    this.#ensurePort()
    return () => { this.#workHistoryListeners.delete(listener) }
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
