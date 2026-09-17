import { expect, it } from 'vitest'
import { NativeMessagingTransport } from '../src/adapters/chrome/NativeMessagingTransport'

it('treats a forbidden Native Messaging host as install-required for the current Extension ID', async () => {
  let onDisconnect: (() => void) | undefined
  const port = {
    onMessage: { addListener() {} },
    onDisconnect: { addListener(listener: () => void) { onDisconnect = listener } },
    postMessage() { onDisconnect?.() },
    disconnect() {},
  } as unknown as chrome.runtime.Port
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        connectNative: () => port,
        lastError: { message: 'Access to the specified native messaging host is forbidden.' },
      },
    },
  })
  try {
    await expect(new NativeMessagingTransport('com.beforewave.agent_helm').probe()).resolves.toEqual({
      state: 'install-required',
      message: 'Agent Helm was not found locally. Install or reinstall Agent Helm.',
    })
  } finally {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
    else delete (globalThis as { chrome?: unknown }).chrome
  }
})

it('times out one request without disconnecting the shared Native Messaging port or rejecting other requests', async () => {
  let onMessage: ((message: unknown) => void) | undefined
  let onDisconnect: (() => void) | undefined
  let disconnectCalls = 0
  let connectCalls = 0
  const posted: Array<{ id: string; method: string }> = []
  const port = {
    onMessage: { addListener(listener: (message: unknown) => void) { onMessage = listener } },
    onDisconnect: { addListener(listener: () => void) { onDisconnect = listener } },
    postMessage(message: { id: string; method: string }) { posted.push(message) },
    disconnect() { disconnectCalls += 1; onDisconnect?.() },
  } as unknown as chrome.runtime.Port
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        connectNative: () => { connectCalls += 1; return port },
      },
    },
  })
  try {
    const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
    const slow = transport.request('slowWorkHistory', [], 10)
    const fast = transport.request<string>('supervisorHealth', [], 100)
    await expect(slow).rejects.toThrow('Native Messaging request timed out')
    const fastRequest = posted.find((request) => request.method === 'supervisorHealth')
    expect(fastRequest).toBeDefined()
    onMessage?.({ id: fastRequest!.id, result: 'ok' })
    await expect(fast).resolves.toBe('ok')
    expect(disconnectCalls).toBe(0)
    expect(connectCalls).toBe(1)
  } finally {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
    else delete (globalThis as { chrome?: unknown }).chrome
  }
})

it('reassembles a response split into bounded Native Messaging chunks', async () => {
  let onMessage: ((message: unknown) => void) | undefined
  let disconnectCalls = 0
  const posted: Array<{ id: string; method: string }> = []
  const port = {
    onMessage: { addListener(listener: (message: unknown) => void) { onMessage = listener } },
    onDisconnect: { addListener() {} },
    postMessage(message: { id: string; method: string }) { posted.push(message) },
    disconnect() { disconnectCalls += 1 },
  } as unknown as chrome.runtime.Port
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: { runtime: { connectNative: () => port } },
  })
  try {
    const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
    const pending = transport.request<{ timeline: string }>('getChatSessionTimeline', [], 1_000)
    const request = posted[0]
    expect(request).toBeDefined()

    const logical = Buffer.from(JSON.stringify({
      id: request!.id,
      result: { timeline: 'activity'.repeat(180_000) },
    }), 'utf8')
    const chunkSize = 512 * 1024
    const total = Math.ceil(logical.length / chunkSize)
    const frames = Array.from({ length: total }, (_, index) => ({
      id: request!.id,
      chunk: {
        index,
        total,
        data: logical.subarray(index * chunkSize, (index + 1) * chunkSize).toString('base64'),
      },
    }))
    for (const frame of frames.reverse()) onMessage?.(frame)

    await expect(pending).resolves.toEqual({ timeline: 'activity'.repeat(180_000) })
    expect(disconnectCalls).toBe(0)
  } finally {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
    else delete (globalThis as { chrome?: unknown }).chrome
  }
})

it('delivers unsolicited Work History invalidation without a request id', () => {
  let onMessage: ((message: unknown) => void) | undefined
  const port = {
    onMessage: { addListener(listener: (message: unknown) => void) { onMessage = listener } },
    onDisconnect: { addListener() {} },
    postMessage() {},
    disconnect() {},
  } as unknown as chrome.runtime.Port
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: { runtime: { connectNative: () => port } },
  })
  try {
    const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
    let changes = 0
    const unsubscribe = transport.subscribeWorkHistoryChanges(() => { changes += 1 })
    onMessage?.({ event: 'work-history-changed' })
    expect(changes).toBe(1)
    unsubscribe()
    onMessage?.({ event: 'work-history-changed' })
    expect(changes).toBe(1)
  } finally {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
    else delete (globalThis as { chrome?: unknown }).chrome
  }
})
