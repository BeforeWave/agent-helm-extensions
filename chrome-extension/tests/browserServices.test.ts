import { describe, expect, it } from 'vitest'
import uiContractManifest from '@beforewave/agent-helm-ui-contract/package.json'
import { agentHelmInstallerSourceForRelease, agentHelmMacosInstallerFilename, loadAgentHelmInstallerSource } from '@beforewave/agent-helm-ui-contract'
import { isSupportedLocalDeepLink } from '../src/services/deepLink'
import { NativeMessagingTransport } from '../src/adapters/chrome/NativeMessagingTransport'
import { ChromeBrowserCapabilities } from '../src/adapters/chrome/ChromeBrowserCapabilities'
import { notificationIdForWork, workIdFromNotificationId } from '../src/services/notifications'

import { NativeAgentHelmService } from '../src/adapters/chrome/NativeAgentHelmService'

const agentHelmInstallerSource = agentHelmInstallerSourceForRelease(uiContractManifest.version)

describe('browser service helpers', () => {
  it('allows only established VS Code local deep-link schemes', () => {
    expect(isSupportedLocalDeepLink('vscode://file/tmp/example.ts')).toBe(true)
    expect(isSupportedLocalDeepLink('vscode-insiders://file/tmp/example.ts')).toBe(true)
    expect(isSupportedLocalDeepLink('https://example.com/')).toBe(false)
  })

  it('round-trips Work History notification ids', () => {
    const id = notificationIdForWork('work/a b')
    expect(workIdFromNotificationId(id)).toBe('work/a b')
    expect(workIdFromNotificationId('other:notification')).toBeNull()
  })

  it('downloads one static macOS PKG using an Extension-ID-bound local filename', async () => {
    const extensionId = 'bnmokhimnnlfohfjbgigcmpckkncffdo'
    const calls: chrome.downloads.DownloadOptions[] = []
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        downloads: {
          async download(options: chrome.downloads.DownloadOptions) {
            calls.push(options)
            return 1
          },
        },
      },
    })
    try {
      const browser = new ChromeBrowserCapabilities()
      const filename = agentHelmMacosInstallerFilename(uiContractManifest.version, extensionId)
      await browser.downloadFile(agentHelmInstallerSource.macos.downloadUrl, filename)
      expect(calls).toEqual([{
        url: agentHelmInstallerSource.macos.downloadUrl,
        filename: `Agent-Helm-${agentHelmInstallerSource.macos.version}--chrome-${extensionId}.pkg`,
        saveAs: false,
        conflictAction: 'overwrite',
      }])
      expect(() => agentHelmMacosInstallerFilename(uiContractManifest.version, 'invalid')).toThrow('Invalid Chrome Extension ID')
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('resolves the Agent Helm installer version from the Chrome compatibility channel', async () => {
    const source = await loadAgentHelmInstallerSource({
      fetch: async () => new Response(JSON.stringify({
        schemaVersion: 1,
        agentHelm: { version: '9.8.7', releaseUrl: 'https://github.com/BeforeWave/agent-helm/releases' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    })
    expect(source.macos.version).toBe('9.8.7')
    expect(source.macos.downloadUrl).toBe('https://github.com/BeforeWave/agent-helm/releases/download/v9.8.7/Agent-Helm-9.8.7.pkg')
  })

  it('resolves an explicit loopback UAT installer release without weakening the production default', async () => {
    const releaseUrl = 'http://127.0.0.1:48766/agent-helm/releases'
    const source = await loadAgentHelmInstallerSource({
      compatibilityUrl: 'http://127.0.0.1:48766/compatibility/chrome.json',
      expectedReleaseUrl: releaseUrl,
      fetch: async () => new Response(JSON.stringify({
        schemaVersion: 1,
        agentHelm: { version: '9.8.7', releaseUrl },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    })
    expect(source.macos.downloadUrl).toBe('http://127.0.0.1:48766/agent-helm/releases/download/v9.8.7/Agent-Helm-9.8.7.pkg')
  })

  it('rejects non-loopback installer release overrides', async () => {
    await expect(loadAgentHelmInstallerSource({
      compatibilityUrl: 'https://example.com/compatibility/chrome.json',
      expectedReleaseUrl: 'https://example.com/releases',
      fetch: async () => new Response('{}', { status: 200 }),
    })).rejects.toThrow('official release or an explicit loopback UAT endpoint')
  })

  it('bounds a stalled Agent Helm installer lookup', async () => {
    await expect(loadAgentHelmInstallerSource({
      timeoutMs: 5,
      fetch: async (_input, init) => await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) {
          reject(new Error('missing abort signal'))
          return
        }
        if (signal.aborted) {
          reject(new Error('aborted'))
          return
        }
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    })).rejects.toThrow('aborted')
  })

  it('treats an installed Native Host with a stopped daemon as an available local bridge', async () => {
    let onMessage: ((message: unknown) => void) | undefined
    const port = {
      onMessage: { addListener(listener: (message: unknown) => void) { onMessage = listener } },
      onDisconnect: { addListener() {} },
      postMessage(message: { id: string }) {
        onMessage?.({ id: message.id, result: { connected: false } })
      },
    } as unknown as chrome.runtime.Port
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { connectNative: () => port } },
    })
    try {
      const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
      expect(await transport.probe()).toEqual({ state: 'connected' })
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('disconnects a hung Native Messaging port and rejects every pending request on that port', async () => {
    let disconnectCalls = 0
    const port = {
      onMessage: { addListener() {} },
      onDisconnect: { addListener() {} },
      postMessage() {},
      disconnect() { disconnectCalls += 1 },
    } as unknown as chrome.runtime.Port
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { connectNative: () => port } },
    })
    try {
      const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
      const timedOut = transport.request('hung-request', [], 5)
      const sharedPortRequest = transport.request('shared-port-request', [], 1_000)
      await expect(timedOut).rejects.toThrow('timed out after 5ms')
      await expect(sharedPortRequest).rejects.toThrow('timed out after 5ms: hung-request')
      expect(disconnectCalls).toBe(1)
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('supports interaction-bound Native Messaging requests without a fixed timeout', async () => {
    let onMessage: ((message: unknown) => void) | undefined
    const port = {
      onMessage: { addListener(listener: (message: unknown) => void) { onMessage = listener } },
      onDisconnect: { addListener() {} },
      postMessage(message: { id: string }) {
        setTimeout(() => onMessage?.({ id: message.id, result: { cancelled: true } }), 15)
      },
      disconnect() {},
    } as unknown as chrome.runtime.Port
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { connectNative: () => port } },
    })
    try {
      const transport = new NativeMessagingTransport('com.beforewave.agent_helm')
      await expect(transport.request('interactive-request', [], null)).resolves.toEqual({ cancelled: true })
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('registers a workspace through the Native Host without a fixed picker timeout and refreshes the authoritative workspace list', async () => {
    const requests: Array<{ method: string; params?: unknown[]; timeoutMs?: number | null }> = []
    const transport = {
      async request(method: string, params?: unknown[], timeoutMs?: number | null) {
        requests.push({ method, params, timeoutMs })
        if (method === 'chooseAndRegisterWorkspace') return { cancelled: false, workspace: { id: 'workspace-example', title: 'example' } }
        if (method === 'supervisorHealth') {
          return {
            status: 'running',
            running: true,
            clientLifecycle: { configurable: true },
            externalCapabilities: {},
            externalUserAccess: {},
            tunnel: { running: false },
            localMcp: { enabled: false },
            adapters: [],
          }
        }
        if (method === 'listChatSessionSummaryPage') return { sessions: [] }
        if (method === 'listWorkspaces') return [{ id: 'workspace-example', title: 'example' }]
        throw new Error(`Unexpected native method: ${method}`)
      },
    } as unknown as NativeMessagingTransport

    const service = new NativeAgentHelmService(transport)
    const snapshot = await service.addWorkspace()

    expect(requests[0]).toEqual({ method: 'chooseAndRegisterWorkspace', params: [], timeoutMs: null })
    expect(snapshot?.workspaces).toEqual([{ id: 'workspace-example', title: 'example', available: true }])
  })


  it('routes dependency installation through the Native Host into Core control RPC', async () => {
    const requests: Array<{ method: string; params?: unknown[]; timeoutMs?: number | null }> = []
    const health = {
      status: 'ok',
      running: true,
      clientLifecycle: { configurable: true },
      dependencies: {
        serena: {
          configured: true,
          available: true,
          command: 'serena',
          install: {
            automatic: true,
            url: 'https://github.com/oraios/serena',
            command: 'uv tool install -p 3.13 serena-agent',
          },
        },
        tunnelClient: {
          configured: false,
          available: false,
          command: 'tunnel-client',
          install: {
            automatic: false,
            url: 'https://github.com/openai/tunnel-client/releases',
          },
        },
      },
      serena: { connected: false, runtimes: [] },
      tunnel: { running: false },
      localMcp: { enabled: false },
      externalCapabilities: {},
      externalUserAccess: {},
      adapters: [],
    }
    const transport = {
      async request(method: string, params?: unknown[], timeoutMs?: number | null) {
        requests.push({ method, params, timeoutMs })
        if (method === 'installDependency') return health
        if (method === 'supervisorHealth') return health
        if (method === 'listChatSessionSummaryPage') return { sessions: [] }
        if (method === 'listWorkspaces') return []
        throw new Error('Unexpected native method: ' + method)
      },
    } as unknown as NativeMessagingTransport

    const service = new NativeAgentHelmService(transport)
    const snapshot = await service.installDependency('serena')

    expect(requests[0]).toEqual({ method: 'installDependency', params: ['serena'], timeoutMs: 360_000 })
    expect(snapshot.dependencies.serena).toMatchObject({
      state: 'ready',
      command: 'serena',
      installCommand: 'uv tool install -p 3.13 serena-agent',
    })
  })

  it('keeps a disabled Accordion collapsed without mounting its body', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { Accordion } = await import('../src/components/Accordion')
    const markup = renderToStaticMarkup(React.createElement(Accordion, {
      title: 'Agents',
      expanded: true,
      disabled: true,
      onToggle: () => {},
      children: React.createElement('div', { className: 'should-not-mount' }, 'Agent body'),
    }))
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('points="5 8 10 13 15 8"')
    expect(markup).toContain('color:var(--helm-secondary)')
    expect(markup).not.toContain('accordion__body')
    expect(markup).not.toContain('should-not-mount')
  })

  it('sends Tunnel credentials only through the Native mutation and refreshes a sanitized snapshot', async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = []
    const transport = {
      async request(method: string, params?: unknown[]) {
        requests.push({ method, params })
        if (method === 'configureTunnel') return { ok: true }
        if (method === 'supervisorHealth') return {
          status: 'ok',
          running: true,
          clientLifecycle: { configurable: true },
          externalCapabilities: {},
          externalUserAccess: {},
          tunnel: { running: true, configured: true, tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKeyConfigured: true },
          localMcp: { enabled: false },
          adapters: [],
        }
        if (method === 'listChatSessionSummaryPage') return { sessions: [] }
        if (method === 'listWorkspaces') return []
        throw new Error('Unexpected native method: ' + method)
      },
    } as unknown as NativeMessagingTransport

    const service = new NativeAgentHelmService(transport)
    const snapshot = await service.configureTunnel({ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKey: 'runtime-secret' })

    expect(requests[0]).toEqual({ method: 'configureTunnel', params: [{ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKey: 'runtime-secret' }] })
    expect(snapshot.settings.find((setting) => setting.id === 'tunnel')).toMatchObject({ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKeyConfigured: true })
    expect(JSON.stringify(snapshot)).not.toContain('runtime-secret')
  })

})
