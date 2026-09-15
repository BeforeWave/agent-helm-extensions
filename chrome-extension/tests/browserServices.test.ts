import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import extensionManifest from '../package.json'
import { agentHelmInstallerSourceForRelease, agentHelmMacosInstallerFilename } from '@beforewave/agent-helm-ui-contract'
import { isSupportedLocalDeepLink } from '../src/services/deepLink'
import { NativeMessagingTransport } from '../src/adapters/chrome/NativeMessagingTransport'
import { ChromeBrowserCapabilities } from '../src/adapters/chrome/ChromeBrowserCapabilities'
import { notificationIdForWork, workIdFromNotificationId } from '../src/services/notifications'

import { NativeAgentHelmService } from '../src/adapters/chrome/NativeAgentHelmService'

const agentHelmInstallerSource = agentHelmInstallerSourceForRelease(extensionManifest.version)

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

  it('exposes a static win32-x64 installer from the same Extension release', () => {
    expect(agentHelmInstallerSource.windows).toEqual({
      version: extensionManifest.version,
      releaseVersion: extensionManifest.version,
      platform: 'win32-x64',
      releaseUrl: 'https://github.com/BeforeWave/agent-helm-extensions/releases',
      assetName: `Agent-Helm-Installer-${extensionManifest.version}-win32-x64.cmd`,
      downloadUrl: `https://github.com/BeforeWave/agent-helm-extensions/releases/download/v${extensionManifest.version}/Agent-Helm-Installer-${extensionManifest.version}-win32-x64.cmd`,
    })
  })

  it('downloads the static macOS PKG using the strict Chrome ID override filename', async () => {
    const extensionId = 'bnmokhimnnlfohfjbgigcmpckkncffdo'
    const calls: chrome.downloads.DownloadOptions[] = []
    const permissionRequests: string[][] = []
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        permissions: {
          async contains() { return false },
          async request(input: chrome.permissions.Permissions) { permissionRequests.push(input.permissions ?? []); return true },
        },
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
      const filename = agentHelmMacosInstallerFilename(extensionManifest.version, extensionId)
      await browser.downloadFile(agentHelmInstallerSource.macos.downloadUrl, filename)
      expect(permissionRequests).toEqual([['downloads']])
      expect(calls).toEqual([{
        url: agentHelmInstallerSource.macos.downloadUrl,
        filename: `Agent-Helm-Installer-${agentHelmInstallerSource.macos.version}--chrome-${extensionId}.pkg`,
        saveAs: true,
        conflictAction: 'overwrite',
      }])
      expect(() => agentHelmMacosInstallerFilename(extensionManifest.version, 'invalid')).toThrow('Invalid Chrome Extension ID')
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('fails closed when the user declines the optional downloads permission', async () => {
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        permissions: { async contains() { return false }, async request() { return false } },
        downloads: { async download() { throw new Error('must not download without permission') } },
      },
    })
    try {
      await expect(new ChromeBrowserCapabilities().downloadFile(agentHelmInstallerSource.macos.downloadUrl, 'installer.pkg')).rejects.toThrow('Download permission is required')
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
  })

  it('hands Popup Agents navigation to background exactly once through session storage', async () => {
    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
    const sessionState: Record<string, unknown> = {}
    const runtimeMessages: unknown[] = []
    const openedWindows: number[] = []
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          async sendMessage(message: unknown) {
            runtimeMessages.push(message)
            return { ok: true, openOptions: { windowId: 17 } }
          },
        },
        sidePanel: { async open({ windowId }: { windowId: number }) { openedWindows.push(windowId) } },
        storage: {
          session: {
            async set(value: Record<string, unknown>) { Object.assign(sessionState, value) },
            async get(key: string) { return { [key]: sessionState[key] } },
            async remove(key: string) { delete sessionState[key] },
          },
        },
      },
    })
    try {
      const browser = new ChromeBrowserCapabilities()
      await browser.openSidePanel('agents')
      expect(runtimeMessages).toEqual([{ type: 'agent-helm:open-side-panel' }])
      expect(openedWindows).toEqual([17])
      expect(sessionState.agentHelmPendingSettingsSection).toBe('agents')
      expect(await browser.consumePendingSettingsSection()).toBe('agents')
      expect(await browser.consumePendingSettingsSection()).toBeNull()
      await browser.openSidePanel('tunnel')
      expect(sessionState.agentHelmPendingSettingsSection).toBe('tunnel')
      expect(await browser.consumePendingSettingsSection()).toBe('tunnel')
      expect(runtimeMessages).toEqual([
        { type: 'agent-helm:open-side-panel' },
        { type: 'agent-helm:open-side-panel' },
      ])
      expect(openedWindows).toEqual([17, 17])
    } finally {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    }
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

  it('keeps the production settings shell mounted under the loading overlay', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { LoadingSurface } = await import('../src/components/LoadingSurface')
    const { ExtensionSettingsControls } = await import('../src/components/ExtensionSettingsControls')
    const controls = React.createElement(ExtensionSettingsControls, {
      snapshot: null,
      loading: true,
      pending: null,
      includeCoreRow: false,
      onCapabilityChange: () => {},
      onAgentChange: () => {},
      onSettingChange: () => {},
      onDependencyInstall: () => {},
      onOpenUrl: () => {},
      onInstallerDownload: () => {},
    })
    const markup = renderToStaticMarkup(React.createElement(LoadingSurface, {
      loading: true,
      label: 'Loading…',
      children: controls,
    }))
    expect(markup).toContain('loading-surface__overlay')
    expect(markup).toContain('loading-surface__content')
    expect(markup).toContain('Capabilities')
    expect(markup).toContain('Agents')
    expect(markup).toContain('Code Sense')
    expect(markup).toContain('ChatGPT Secure Tunnel')
  })

  it('keeps the Accordion row as disclosure while the title owns the separate action', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { Accordion } = await import('../src/components/Accordion')
    const markup = renderToStaticMarkup(React.createElement(Accordion, {
      title: 'Tunnel',
      expanded: false,
      onToggle: () => {},
      onTitleClick: () => {},
      children: React.createElement('div', null, 'Tunnel setup'),
    }))
    expect(markup).toContain('accordion__trigger--split')
    expect(markup.match(/<button/g)).toHaveLength(1)
    expect(markup).toContain('role="button"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('Tunnel setup')
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
          tunnel: { running: true, configured: true, tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKeyConfigured: true, proxyConfigured: true, proxyUrl: 'http://proxy-user:proxy-pass@127.0.0.1:7890' },
          localMcp: { enabled: false },
          adapters: [],
        }
        if (method === 'listChatSessionSummaryPage') return { sessions: [] }
        if (method === 'listWorkspaces') return []
        throw new Error('Unexpected native method: ' + method)
      },
    } as unknown as NativeMessagingTransport

    const service = new NativeAgentHelmService(transport)
    const snapshot = await service.configureTunnel({ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKey: 'runtime-secret', proxyUrl: 'http://proxy-user:proxy-pass@127.0.0.1:7890' })

    expect(requests[0]).toEqual({ method: 'configureTunnel', params: [{ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKey: 'runtime-secret', proxyUrl: 'http://proxy-user:proxy-pass@127.0.0.1:7890' }] })
    expect(snapshot.settings.find((setting) => setting.id === 'tunnel')).toMatchObject({ tunnelId: 'tunnel_saved', organizationId: 'org_saved', apiKeyConfigured: true, proxyConfigured: true, proxyUrl: 'http://proxy-user:proxy-pass@127.0.0.1:7890' })
    expect(JSON.stringify(snapshot)).not.toContain('runtime-secret')
  })


  it('keeps dev:web as a thin host around the production Extension apps', async () => {
    const source = readFileSync(new URL('../preview/PreviewApp.tsx', import.meta.url), 'utf8')
    expect(source).toContain("import { PopupApp } from '../src/app/PopupApp'")
    expect(source).toContain("import { SidePanelApp } from '../src/app/SidePanelApp'")
    expect(source).toContain("import { ExpandedDetailApp } from '../src/app/ExpandedDetailApp'")
    expect(source).toContain('<PopupApp client={runtime.client} />')
    expect(source).toContain('<SidePanelApp client={runtime.client} />')
    expect(source).toContain('Language')
    expect(source).toContain('Theme')
    expect(source).not.toContain('popup-setting-row')

    const { MockBrowserCapabilities } = await import('../src/adapters/mock/MockBrowserCapabilities')
    let section: 'agents' | 'tunnel' | undefined
    const browser = new MockBrowserCapabilities({ onOpenSidePanel: (value) => { section = value } })
    await browser.openSidePanel('agents')
    expect(section).toBe('agents')
    expect(await browser.consumePendingSettingsSection()).toBe('agents')
    await browser.openSidePanel('tunnel')
    expect(section).toBe('tunnel')
    expect(await browser.consumePendingSettingsSection()).toBe('tunnel')
  })

  it('derives Work Detail runtime from timeline metadata and preserves partial detail on timeline failure', async () => {
    const summary = {
      id: 'work-runtime',
      boundIntents: [],
      chatUrls: [],
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:01:00.000Z',
      lastActivityAt: '2026-09-12T00:01:00.000Z',
      eventCount: 0,
      chatCount: 1,
      delegationCount: 0,
      presentation: { title: 'Runtime work' },
    }
    const delegated = new NativeAgentHelmService({
      async request(method: string) {
        if (method === 'getChatSessionSummary') return summary
        if (method === 'getChatSessionTimeline') return [{
          id: 'delegation:1',
          timestamp: '2026-09-12T00:01:00.000Z',
          actor: 'subagent',
          actorName: 'DSH',
          presentation: { title: { kind: 'label', label: 'delegation.status' }, details: [] },
        }]
        throw new Error('Unexpected native method: ' + method)
      },
    } as unknown as NativeMessagingTransport)
    await expect(delegated.getWorkDetail('work-runtime')).resolves.toMatchObject({
      title: 'Runtime work',
      agentLabel: 'DSH',
      runtimeLabel: 'Native session',
      timeline: [{ actor: 'subagent', actorName: 'DSH' }],
    })

    const partial = new NativeAgentHelmService({
      async request(method: string) {
        if (method === 'getChatSessionSummary') return summary
        if (method === 'getChatSessionTimeline') throw new Error('timeline transport failed')
        throw new Error('Unexpected native method: ' + method)
      },
    } as unknown as NativeMessagingTransport)
    await expect(partial.getWorkDetail('work-runtime')).resolves.toMatchObject({
      title: 'Runtime work',
      timeline: [],
      timelineError: 'timeline transport failed',
    })
  })

})
