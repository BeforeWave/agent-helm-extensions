import { afterEach, describe, expect, it } from 'vitest'
import { BackgroundAgentHelmService } from '../src/adapters/chrome/BackgroundAgentHelmService'
import { ChromeBrowserCapabilities } from '../src/adapters/chrome/ChromeBrowserCapabilities'
import { installBackgroundHandlers } from '../src/adapters/chrome/installBackgroundHandlers'
import type { AgentHelmServiceAdapter } from '../src/models/adapters'
import type { ControlPlaneSnapshot, WorkHistoryDetail } from '../src/models/controlPlane'

function createEvent<T extends (...args: any[]) => any>() {
  const listeners = new Set<T>()
  return {
    addListener(listener: T) { listeners.add(listener) },
    removeListener(listener: T) { listeners.delete(listener) },
    emit(...args: Parameters<T>) {
      for (const listener of [...listeners]) listener(...args)
    },
    values() { return [...listeners] },
  }
}

function makeSnapshot(workId = 'work-1', coreEnabled = true): ControlPlaneSnapshot {
  return {
    connection: { state: 'connected' },
    capabilities: {
      understand: { enabled: true, available: true },
      code: { enabled: true, available: true },
      command: { enabled: true, available: true },
    },
    dependencies: {
      serena: { state: 'ready', command: 'serena' },
      tunnelClient: { state: 'ready', command: 'tunnel-client' },
    },
    agents: [],
    settings: [{ id: 'core', label: 'Agent Helm Service', kind: 'toggle', state: 'running', enabled: coreEnabled }],
    workspaces: [],
    works: workId ? [{
      id: workId,
      title: workId,
      lastActivityAt: '2026-09-13T00:00:00.000Z',
      eventCount: 1,
      chatCount: 1,
      delegationCount: 0,
    }] : [],
  }
}

function createMutableService(initial = makeSnapshot()) {
  let snapshot = structuredClone(initial)
  const detail = (workId: string): WorkHistoryDetail => ({
    ...snapshot.works.find((work) => work.id === workId)!,
    createdAt: '2026-09-13T00:00:00.000Z',
    boundIntents: [],
    chatUrls: [],
    timeline: [],
  })
  const service: AgentHelmServiceAdapter = {
    async getSnapshot() { return structuredClone(snapshot) },
    async getWorkDetail(workId) { return detail(workId) },
    async getWorkTimelineUpdates(_workId, afterSequence) { return { cursorSequence: afterSequence, updates: [] } },
    async releaseWorkTimeline() {},
    async getWorkHistoryPage() { return { works: structuredClone(snapshot.works) } },
    async findWorkByConversation() { return null },
    async addWorkspace() { return structuredClone(snapshot) },
    async setCapability(capability, enabled) {
      snapshot = { ...snapshot, capabilities: { ...snapshot.capabilities, [capability]: { ...snapshot.capabilities[capability], enabled } } }
      return structuredClone(snapshot)
    },
    async setAgentEnabled() { return structuredClone(snapshot) },
    async configureTunnel() { return structuredClone(snapshot) },
    async setSetting(settingId, enabled) {
      snapshot = {
        ...snapshot,
        settings: snapshot.settings.map((setting) => setting.id === settingId ? { ...setting, enabled } : setting),
      }
      return structuredClone(snapshot)
    },
    async installDependency() { return structuredClone(snapshot) },
    async bindConversation(workId) { return detail(workId) },
  }
  return {
    service,
    setSnapshot(next: ControlPlaneSnapshot) { snapshot = structuredClone(next) },
  }
}

type RuntimeListener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | void

function installFakeChrome(initialTabs: chrome.tabs.Tab[]) {
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  const runtimeMessages = createEvent<RuntimeListener>()
  const runtimeConnects = createEvent<(port: chrome.runtime.Port) => void>()
  const alarmEvents = createEvent<(alarm: chrome.alarms.Alarm) => void>()
  const activatedEvents = createEvent<(info: chrome.tabs.OnActivatedInfo) => void>()
  const updatedEvents = createEvent<(tabId: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void>()
  const notificationEvents = createEvent<(notificationId: string) => void>()
  const windowRemovedEvents = createEvent<(windowId: number) => void>()
  const sidePanelClosedEvents = createEvent<(info: chrome.sidePanel.PanelClosedInfo) => void>()
  const tabs = initialTabs.map((tab) => ({ ...tab }))
  const sessionState: Record<string, unknown> = {}
  const sidePanelEnabled = new Map<number, boolean>()
  const sidePanelOptions = new Map<number, { path?: string; enabled?: boolean }>()
  let sidePanelDefaultOptions: { path?: string; enabled?: boolean } = {}
  const sidePanelOpenCalls: Array<{ tabId?: number; windowId?: number }> = []
  const sidePanelCloseCalls: Array<{ tabId?: number; windowId?: number }> = []
  const openedSidePanelTabs = new Set<number>()
  const globalSidePanelWindows = new Set<number>()

  function connect(connectInfo?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
    const name = connectInfo?.name ?? ''
    const clientMessages = createEvent<(message: unknown) => void>()
    const backgroundMessages = createEvent<(message: unknown) => void>()
    const clientDisconnect = createEvent<() => void>()
    const backgroundDisconnect = createEvent<() => void>()
    let disconnected = false
    const disconnect = () => {
      if (disconnected) return
      disconnected = true
      clientDisconnect.emit()
      backgroundDisconnect.emit()
    }
    const clientPort = {
      name,
      onMessage: clientMessages,
      onDisconnect: clientDisconnect,
      postMessage(message: unknown) { if (!disconnected) backgroundMessages.emit(message) },
      disconnect,
      sender: undefined,
    } as unknown as chrome.runtime.Port
    const backgroundPort = {
      name,
      onMessage: backgroundMessages,
      onDisconnect: backgroundDisconnect,
      postMessage(message: unknown) { if (!disconnected) clientMessages.emit(message) },
      disconnect,
      sender: { id: 'test-extension' } as chrome.runtime.MessageSender,
    } as unknown as chrome.runtime.Port
    runtimeConnects.emit(backgroundPort)
    return clientPort
  }

  async function sendMessage(message: unknown): Promise<unknown> {
    return await new Promise((resolve, reject) => {
      let asyncResponse = false
      let settled = false
      const sendResponse = (response?: unknown) => {
        if (settled) return
        settled = true
        resolve(response)
      }
      for (const listener of runtimeMessages.values()) {
        if (listener(message, { id: 'test-extension' } as chrome.runtime.MessageSender, sendResponse) === true) asyncResponse = true
      }
      if (!asyncResponse && !settled) {
        settled = true
        resolve(undefined)
      } else if (asyncResponse) {
        setTimeout(() => {
          if (!settled) reject(new Error('runtime message did not respond'))
        }, 250)
      }
    })
  }

  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        id: 'test-extension',
        sendMessage,
        connect,
        onMessage: runtimeMessages,
        onConnect: runtimeConnects,
      },
      alarms: {
        create() {},
        onAlarm: alarmEvents,
      },
      tabs: {
        async query(query: chrome.tabs.QueryInfo) {
          let result = tabs
          if (typeof query.windowId === 'number') result = result.filter((tab) => tab.windowId === query.windowId)
          if (query.active) result = result.filter((tab) => tab.active)
          if (query.active && query.currentWindow) result = result.slice(0, 1)
          return result.map((tab) => ({ ...tab }))
        },
        async get(tabId: number) {
          const tab = tabs.find((candidate) => candidate.id === tabId)
          if (!tab) throw new Error(`Unknown tab ${tabId}`)
          return { ...tab }
        },
        onActivated: activatedEvents,
        onUpdated: updatedEvents,
      },
      sidePanel: {
        onClosed: sidePanelClosedEvents,
        async setOptions(options: chrome.sidePanel.PanelOptions) {
          if (typeof options.tabId !== 'number') {
            sidePanelDefaultOptions = { ...sidePanelDefaultOptions, ...options }
            return
          }
          const current = sidePanelOptions.get(options.tabId) ?? {}
          const next = { ...current, ...options }
          sidePanelOptions.set(options.tabId, next)
          if (typeof options.enabled === 'boolean') sidePanelEnabled.set(options.tabId, options.enabled)
        },
        async open(options: { tabId?: number; windowId?: number }) {
          if (typeof options.tabId === 'number') {
            const specific = sidePanelOptions.get(options.tabId)
            if (!specific || specific.enabled === false || !specific.path) throw new Error(`No active side panel for tabId: ${options.tabId}`)
          } else if (typeof options.windowId === 'number' && sidePanelDefaultOptions.enabled === false) {
            throw new Error(`No active global side panel for windowId: ${options.windowId}`)
          }
          if (typeof options.tabId === 'number') openedSidePanelTabs.add(options.tabId)
          if (typeof options.windowId === 'number') globalSidePanelWindows.add(options.windowId)
          sidePanelOpenCalls.push({ ...options })
        },
        async close(options: { tabId?: number; windowId?: number }) {
          sidePanelCloseCalls.push({ ...options })
          if (typeof options.tabId === 'number') openedSidePanelTabs.delete(options.tabId)
          if (typeof options.windowId === 'number') globalSidePanelWindows.delete(options.windowId)
        },
      },
      storage: {
        session: {
          async set(value: Record<string, unknown>) { Object.assign(sessionState, value) },
          async get(key: string) { return { [key]: sessionState[key] } },
          async remove(key: string) { delete sessionState[key] },
        },
      },
      notifications: {
        onClicked: notificationEvents,
        async clear() { return true },
      },
      windows: { onRemoved: windowRemovedEvents },
      action: { async setIcon() {} },
    },
  })

  return {
    alarm(name = 'agent-helm-action-status') { alarmEvents.emit({ name, scheduledTime: Date.now(), persistAcrossSessions: false }) },
    activate(tabId: number) {
      const target = tabs.find((tab) => tab.id === tabId)
      if (!target) throw new Error(`Unknown tab ${tabId}`)
      for (const tab of tabs) tab.active = tab.id === tabId
      activatedEvents.emit({ tabId, windowId: target.windowId! })
    },
    updateUrl(tabId: number, url: string) {
      const target = tabs.find((tab) => tab.id === tabId)
      if (!target) throw new Error(`Unknown tab ${tabId}`)
      target.url = url
      updatedEvents.emit(tabId, { url, status: 'complete' }, { ...target })
    },
    sessionState,
    sidePanelEnabled,
    sidePanelOptions,
    get sidePanelDefaultOptions() { return { ...sidePanelDefaultOptions } },
    sidePanelOpenCalls,
    sidePanelCloseCalls,
    openedSidePanelTabs,
    globalSidePanelWindows,
    visibleSidePanelTabId() {
      const activeTab = tabs.find((tab) => tab.active)
      if (!activeTab || typeof activeTab.id !== 'number') return undefined
      if (!openedSidePanelTabs.has(activeTab.id)) return undefined
      if (sidePanelEnabled.get(activeTab.id) === false) return undefined
      return activeTab.id
    },
    closePanel(windowId: number, tabId?: number) {
      if (typeof tabId === 'number') openedSidePanelTabs.delete(tabId)
      globalSidePanelWindows.delete(windowId)
      sidePanelClosedEvents.emit({ windowId, ...(typeof tabId === 'number' ? { tabId } : {}), path: 'sidepanel.html' })
    },
    restore() {
      if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome)
      else delete (globalThis as { chrome?: unknown }).chrome
    },
  }
}

async function flushBackground(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.shift()?.()
})

describe('background-owned Chrome state', () => {
  it('fans a popup mutation out to another open surface through the authoritative background snapshot', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const mutable = createMutableService()
    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const popup = new BackgroundAgentHelmService()
    const sidePanel = new BackgroundAgentHelmService()
    const updates: ControlPlaneSnapshot[] = []
    const unsubscribe = sidePanel.subscribeSnapshot((update) => {
      if (update.snapshot) updates.push(update.snapshot)
    })
    cleanups.push(unsubscribe)

    const result = await popup.setSetting('core', false)
    await flushBackground()

    expect(result.settings.find((setting) => setting.id === 'core')?.enabled).toBe(false)
    expect(updates.at(-1)?.settings.find((setting) => setting.id === 'core')?.enabled).toBe(false)
  })

  it('keeps the last healthy snapshot through one transient bridge regression and recovers without a control toggle', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const healthy: ControlPlaneSnapshot = {
      ...makeSnapshot(),
      settings: [
        ...makeSnapshot().settings,
        { id: 'tunnel', label: 'ChatGPT Secure Tunnel', kind: 'status', state: 'error', message: 'Tunnel setup is incomplete.' },
      ],
    }
    const degraded: ControlPlaneSnapshot = {
      ...makeSnapshot(),
      connection: { state: 'unavailable', message: 'Error when communicating with the native messaging host.' },
      capabilities: {
        understand: { enabled: false, available: false },
        code: { enabled: false, available: false },
        command: { enabled: false, available: false },
      },
      dependencies: {
        serena: { state: 'unavailable', command: 'serena' },
        tunnelClient: { state: 'unavailable', command: 'tunnel-client' },
      },
      settings: [{ id: 'core', label: 'Agent Helm Service', kind: 'toggle', state: 'unavailable', enabled: false }],
    }
    let calls = 0
    const mutable = createMutableService(healthy)
    mutable.service.getSnapshot = async () => {
      calls += 1
      if (calls === 2) return structuredClone(degraded)
      return structuredClone(healthy)
    }
    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const surface = new BackgroundAgentHelmService()
    const updates: Array<{ snapshot: ControlPlaneSnapshot | null; error: string | null }> = []
    const unsubscribe = surface.subscribeSnapshot((update) => updates.push(update))
    cleanups.push(unsubscribe)

    fakeChrome.alarm()
    await flushBackground()
    expect(calls).toBe(2)
    expect(updates.at(-1)?.error).toBe('Error when communicating with the native messaging host.')
    expect(updates.at(-1)?.snapshot?.capabilities.code).toEqual({ enabled: true, available: true })
    expect(updates.at(-1)?.snapshot?.dependencies.tunnelClient.state).toBe('ready')

    await new Promise((resolve) => setTimeout(resolve, 550))
    await flushBackground()
    expect(calls).toBeGreaterThanOrEqual(3)
    expect(updates.at(-1)?.error).toBeNull()
    expect(updates.at(-1)?.snapshot?.capabilities.code).toEqual({ enabled: true, available: true })
    expect(updates.at(-1)?.snapshot?.dependencies.tunnelClient.state).toBe('ready')
  })

  it('shares one backend timeline poll across Work Details subscribers and releases it only after the last surface disconnects', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const mutable = createMutableService()
    const cursors: number[] = []
    let resolvePoll!: (value: Awaited<ReturnType<NonNullable<AgentHelmServiceAdapter['getWorkTimelineUpdates']>>>) => void
    let releases = 0
    mutable.service.getWorkTimelineUpdates = async (_workId, afterSequence) => {
      cursors.push(afterSequence)
      return await new Promise((resolve) => { resolvePoll = resolve })
    }
    mutable.service.releaseWorkTimeline = async () => { releases += 1 }
    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const first = new BackgroundAgentHelmService()
    const second = new BackgroundAgentHelmService()
    const firstUpdates: string[][] = []
    const secondUpdates: string[][] = []
    const unsubscribeFirst = first.subscribeWorkTimeline('work-1', 4, (updates) => firstUpdates.push(updates.map((item) => item.id)))
    const unsubscribeSecond = second.subscribeWorkTimeline('work-1', 4, (updates) => secondUpdates.push(updates.map((item) => item.id)))
    cleanups.push(unsubscribeFirst, unsubscribeSecond)
    await flushBackground()
    expect(cursors).toEqual([4])

    resolvePoll({
      cursorSequence: 5,
      updates: [{
        id: 'live-5', sequence: 5, timestamp: '2026-09-13T00:00:05.000Z', actor: 'chatgpt',
        presentation: { title: { kind: 'label', label: 'action.read' }, details: [] },
      }],
    })
    await flushBackground()
    expect(firstUpdates).toEqual([['live-5']])
    expect(secondUpdates).toEqual([['live-5']])

    unsubscribeFirst()
    await flushBackground()
    expect(releases).toBe(0)
    unsubscribeSecond()
    await flushBackground()
    expect(releases).toBe(1)
  })

  it('rewinds the shared timeline cursor when a behind Work Details surface joins during an in-flight poll', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const mutable = createMutableService()
    const cursors: number[] = []
    let resolveFirst!: (value: Awaited<ReturnType<NonNullable<AgentHelmServiceAdapter['getWorkTimelineUpdates']>>>) => void
    mutable.service.getWorkTimelineUpdates = async (_workId, afterSequence) => {
      cursors.push(afterSequence)
      if (cursors.length === 1) return await new Promise((resolve) => { resolveFirst = resolve })
      return {
        cursorSequence: 12,
        updates: [
          { id: 'live-6', sequence: 6, timestamp: '2026-09-13T00:00:06.000Z', actor: 'chatgpt', presentation: { title: { kind: 'label', label: 'action.read' }, details: [] } },
          { id: 'live-12', sequence: 12, timestamp: '2026-09-13T00:00:12.000Z', actor: 'chatgpt', presentation: { title: { kind: 'label', label: 'action.read' }, details: [] } },
        ],
      }
    }
    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const first = new BackgroundAgentHelmService()
    const second = new BackgroundAgentHelmService()
    const firstUpdates: string[][] = []
    const secondUpdates: string[][] = []
    const unsubscribeFirst = first.subscribeWorkTimeline('work-1', 10, (updates) => firstUpdates.push(updates.map((item) => item.id)))
    cleanups.push(unsubscribeFirst)
    await flushBackground()
    expect(cursors).toEqual([10])

    const unsubscribeSecond = second.subscribeWorkTimeline('work-1', 5, (updates) => secondUpdates.push(updates.map((item) => item.id)))
    cleanups.push(unsubscribeSecond)
    await flushBackground()
    expect(cursors).toEqual([10])

    resolveFirst({
      cursorSequence: 12,
      updates: [{
        id: 'live-12', sequence: 12, timestamp: '2026-09-13T00:00:12.000Z', actor: 'chatgpt',
        presentation: { title: { kind: 'label', label: 'action.read' }, details: [] },
      }],
    })
    for (let attempt = 0; attempt < 5 && (cursors.length < 2 || secondUpdates.length < 1); attempt += 1) await flushBackground()

    expect(cursors.slice(0, 2)).toEqual([10, 5])
    expect(firstUpdates).toEqual([['live-12']])
    expect(secondUpdates).toEqual([['live-6', 'live-12']])
  })

  it('fans authoritative Recent Work changes into already-open surfaces from the single background refresh source', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const mutable = createMutableService(makeSnapshot('work-1'))
    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const surface = new BackgroundAgentHelmService()
    const updates: ControlPlaneSnapshot[] = []
    const unsubscribe = surface.subscribeSnapshot((update) => {
      if (update.snapshot) updates.push(update.snapshot)
    })
    cleanups.push(unsubscribe)

    mutable.setSnapshot(makeSnapshot('work-2'))
    fakeChrome.alarm()
    await flushBackground()

    expect(updates.at(-1)?.works.map((work) => work.id)).toEqual(['work-2'])
  })

  it('does not let a slow stale refresh overwrite a newer control mutation', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
    ])
    const mutable = createMutableService(makeSnapshot('work-1', true))
    const readSnapshot = mutable.service.getSnapshot.bind(mutable.service)
    const staleSnapshot = makeSnapshot('work-1', true)
    let releaseInitial!: () => void
    let firstRead = true
    mutable.service.getSnapshot = async () => {
      if (!firstRead) return readSnapshot()
      firstRead = false
      await new Promise<void>((resolve) => { releaseInitial = resolve })
      return structuredClone(staleSnapshot)
    }

    const dispose = installBackgroundHandlers(mutable.service)
    cleanups.push(dispose, fakeChrome.restore)
    const popup = new BackgroundAgentHelmService()
    const sidePanel = new BackgroundAgentHelmService()
    const updates: ControlPlaneSnapshot[] = []
    const unsubscribe = sidePanel.subscribeSnapshot((update) => {
      if (update.snapshot) updates.push(update.snapshot)
    })
    cleanups.push(unsubscribe)

    const mutation = popup.setSetting('core', false)
    await flushBackground()
    releaseInitial()
    await mutation
    await flushBackground()

    expect(updates.at(-1)?.settings.find((setting) => setting.id === 'core')?.enabled).toBe(false)
  })

  it('opens only the current tab and lets Chrome restore that tab when the user returns', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/example' } as chrome.tabs.Tab,
      { id: 2, windowId: 10, active: false, url: 'https://example.com/' } as chrome.tabs.Tab,
    ])
    const dispose = installBackgroundHandlers(createMutableService().service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    await new ChromeBrowserCapabilities().openSidePanel()
    expect(fakeChrome.sidePanelDefaultOptions).toMatchObject({ enabled: false })
    expect(fakeChrome.sidePanelOptions.get(1)).toMatchObject({ path: 'sidepanel.html', enabled: true })
    expect(fakeChrome.sidePanelOptions.has(2)).toBe(false)
    expect(fakeChrome.sidePanelOpenCalls).toEqual([{ tabId: 1 }])
    expect(fakeChrome.visibleSidePanelTabId()).toBe(1)

    fakeChrome.activate(2)
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBeUndefined()
    expect(fakeChrome.sidePanelOptions.get(1)).toMatchObject({ path: 'sidepanel.html', enabled: true })

    fakeChrome.activate(1)
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBe(1)
    expect(fakeChrome.sidePanelOpenCalls).toEqual([{ tabId: 1 }])
  })

  it('keeps independently opened tabs isolated from each other', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://chatgpt.com/c/one' } as chrome.tabs.Tab,
      { id: 2, windowId: 10, active: false, url: 'https://chatgpt.com/c/two' } as chrome.tabs.Tab,
    ])
    const dispose = installBackgroundHandlers(createMutableService().service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    const browser = new ChromeBrowserCapabilities()
    await browser.openSidePanel()
    fakeChrome.activate(2)
    await flushBackground()
    await browser.openSidePanel()

    expect(fakeChrome.sidePanelOpenCalls).toEqual([{ tabId: 1 }, { tabId: 2 }])
    expect(fakeChrome.sidePanelOptions.get(1)).toMatchObject({ path: 'sidepanel.html', enabled: true })
    expect(fakeChrome.sidePanelOptions.get(2)).toMatchObject({ path: 'sidepanel.html', enabled: true })
    expect(fakeChrome.visibleSidePanelTabId()).toBe(2)

    fakeChrome.activate(1)
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBe(1)

    fakeChrome.closePanel(10, 1)
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBeUndefined()
    expect(fakeChrome.openedSidePanelTabs.has(2)).toBe(true)

    fakeChrome.activate(2)
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBe(2)
  })

  it('uses the tab as the persistence boundary regardless of URL', async () => {
    const fakeChrome = installFakeChrome([
      { id: 1, windowId: 10, active: true, url: 'https://example.com/' } as chrome.tabs.Tab,
      { id: 2, windowId: 10, active: false, url: 'https://chatgpt.com/c/other' } as chrome.tabs.Tab,
    ])
    const dispose = installBackgroundHandlers(createMutableService().service)
    cleanups.push(dispose, fakeChrome.restore)
    await flushBackground()

    await new ChromeBrowserCapabilities().openSidePanel()
    expect(fakeChrome.sidePanelOpenCalls).toEqual([{ tabId: 1 }])
    expect(fakeChrome.sidePanelOptions.get(1)).toMatchObject({ path: 'sidepanel.html', enabled: true })
    expect(fakeChrome.sidePanelOptions.has(2)).toBe(false)
    expect(fakeChrome.globalSidePanelWindows.size).toBe(0)

    fakeChrome.updateUrl(1, 'https://chatgpt.com/c/navigated')
    await flushBackground()
    expect(fakeChrome.visibleSidePanelTabId()).toBe(1)
    expect(fakeChrome.sidePanelOpenCalls).toEqual([{ tabId: 1 }])
  })

})
