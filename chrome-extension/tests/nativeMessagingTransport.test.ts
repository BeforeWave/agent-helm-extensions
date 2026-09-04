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
