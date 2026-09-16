import type { AgentHelmServiceAdapter, ControlPlaneStateUpdate } from '../../models/adapters'
import { deriveExtensionConnectionPresentation, type ControlPlaneSnapshot, type ExtensionConnectionPresentationState } from '../../models/controlPlane'
import { pageContextFromTab } from '../../services/pageContext'
import { workIdFromNotificationId } from '../../services/notifications'
import { createChromeBackgroundService } from '../../client/factories'
import {
  CONTROL_PLANE_REQUEST_MESSAGE,
  CONTROL_PLANE_SNAPSHOT_MESSAGE,
  OPEN_SIDE_PANEL_MESSAGE,
  CONTROL_PLANE_TIMELINE_PORT,
  type ControlPlaneRequestMessage,
} from './BackgroundAgentHelmService'

const ACTION_STATUS_ALARM = 'agent-helm-action-status'
const PANEL_STATE_PREFIX = 'agentHelmSidePanelMode:'
const SIDE_PANEL_PATH = 'sidepanel.html'

interface PanelModeState {
  mode: 'chatgpt-scoped' | 'global'
  sourceTabId: number | null
}

function actionStatusColor(state: ExtensionConnectionPresentationState): string {
  if (state === 'connected') return '#2563eb'
  if (state === 'error') return '#dc2626'
  return '#9ca3af'
}

function createPlugImageData(size: number, state: ExtensionConnectionPresentationState): ImageData {
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create browser action icon canvas')

  // Lucide Cable / Unplug icon geometry (ISC):
  // https://lucide.dev/icons/cable and https://lucide.dev/icons/unplug
  const cablePaths = [
    'M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1',
    'M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9',
    'M21 21v-2h-4',
    'M3 5h4V3',
    'M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3',
  ]
  const unplugPaths = [
    'm19 5 3-3',
    'm2 22 3-3',
    'M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z',
    'M7.5 13.5 10 11',
    'M10.5 16.5 13 14',
    'm12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z',
  ]

  context.clearRect(0, 0, size, size)
  context.save()
  context.scale(size / 24, size / 24)
  context.strokeStyle = actionStatusColor(state)
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const path of state === 'connected' ? cablePaths : unplugPaths) {
    context.stroke(new Path2D(path))
  }
  context.restore()
  return context.getImageData(0, 0, size, size)
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

async function updateBrowserActionStatus(snapshot: ControlPlaneSnapshot | null, error: string | null): Promise<void> {
  const presentation = deriveExtensionConnectionPresentation(snapshot, error)
  await chrome.action.setIcon({ imageData: {
    16: createPlugImageData(16, presentation.state),
    32: createPlugImageData(32, presentation.state),
  } })
}

function panelStateKey(windowId: number): string {
  return `${PANEL_STATE_PREFIX}${windowId}`
}

async function readPanelMode(windowId: number): Promise<PanelModeState | null> {
  const key = panelStateKey(windowId)
  const stored = await chrome.storage.session.get(key)
  const value = stored[key] as Partial<PanelModeState> | undefined
  if (value?.mode === 'global') return { mode: 'global', sourceTabId: null }
  if (value?.mode === 'chatgpt-scoped' && typeof value.sourceTabId === 'number') {
    return { mode: 'chatgpt-scoped', sourceTabId: value.sourceTabId }
  }
  return null
}

async function writePanelMode(windowId: number, state: PanelModeState): Promise<void> {
  await chrome.storage.session.set({ [panelStateKey(windowId)]: state })
}

async function applyPanelMode(windowId: number, state: PanelModeState): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue
    const enabled = state.mode === 'global' || (tab.id === state.sourceTabId && pageContextFromTab(tab).kind !== 'other')
    await chrome.sidePanel.setOptions({ tabId: tab.id, ...(enabled ? { path: SIDE_PANEL_PATH } : {}), enabled })
  }
}

async function syncPanelForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') return
  const state = await readPanelMode(tab.windowId)
  if (!state) return
  const enabled = state.mode === 'global' || (tab.id === state.sourceTabId && pageContextFromTab(tab).kind !== 'other')
  await chrome.sidePanel.setOptions({ tabId: tab.id, ...(enabled ? { path: SIDE_PANEL_PATH } : {}), enabled })
}

async function prepareSidePanelForCurrentTab(): Promise<chrome.sidePanel.OpenOptions> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') throw new Error('No active browser tab')
  const chatGptScoped = pageContextFromTab(tab).kind !== 'other'
  const state: PanelModeState = chatGptScoped
    ? { mode: 'chatgpt-scoped', sourceTabId: tab.id }
    : { mode: 'global', sourceTabId: null }
  await writePanelMode(tab.windowId, state)
  await applyPanelMode(tab.windowId, state)
  return chatGptScoped ? { tabId: tab.id } : { windowId: tab.windowId }
}

export function installBackgroundHandlers(service: AgentHelmServiceAdapter = createChromeBackgroundService()): () => void {
  let state: ControlPlaneStateUpdate = { snapshot: null, error: null }
  let snapshotFingerprint: string | null = null
  let snapshotQueue: Promise<void> = Promise.resolve()

  interface TimelineStreamState {
    ports: Map<chrome.runtime.Port, number>
    cursorSequence: number
    timer: ReturnType<typeof setTimeout> | undefined
    polling: boolean
  }
  const timelineStreams = new Map<string, TimelineStreamState>()
  const timelinePollIntervalMs = 500

  const releaseTimelineStream = (workId: string, stream: TimelineStreamState) => {
    if (stream.timer) clearTimeout(stream.timer)
    stream.timer = undefined
    stream.ports.clear()
    if (timelineStreams.get(workId) !== stream) return
    timelineStreams.delete(workId)
    void service.releaseWorkTimeline?.(workId).catch(() => {})
  }

  const pollTimelineStream = async (workId: string, stream: TimelineStreamState): Promise<void> => {
    if (timelineStreams.get(workId) !== stream || stream.ports.size === 0 || stream.polling) return
    if (!service.getWorkTimelineUpdates) {
      for (const port of stream.ports.keys()) port.postMessage({ type: 'timeline-error', error: 'Work timeline updates are unavailable' })
      releaseTimelineStream(workId, stream)
      return
    }
    stream.polling = true
    const requestedAfterSequence = stream.cursorSequence
    let pollSucceeded = false
    try {
      const batch = await service.getWorkTimelineUpdates(workId, requestedAfterSequence)
      if (timelineStreams.get(workId) !== stream || stream.ports.size === 0) return
      if (!Number.isInteger(batch.cursorSequence) || batch.cursorSequence < requestedAfterSequence) throw new Error('timeline update cursor must be monotonic')
      pollSucceeded = true
      const rewoundDuringPoll = stream.cursorSequence < requestedAfterSequence
      if (!rewoundDuringPoll) stream.cursorSequence = batch.cursorSequence
      for (const [port, portCursor] of [...stream.ports]) {
        if (portCursor < requestedAfterSequence || batch.cursorSequence <= portCursor) continue
        stream.ports.set(port, batch.cursorSequence)
        if (batch.updates.length) port.postMessage({ type: 'timeline', cursorSequence: batch.cursorSequence, updates: batch.updates })
      }
    } catch (cause) {
      const error = errorMessage(cause)
      for (const port of stream.ports.keys()) port.postMessage({ type: 'timeline-error', error })
    } finally {
      stream.polling = false
      if (timelineStreams.get(workId) === stream && stream.ports.size > 0) {
        const catchupPending = pollSucceeded && stream.cursorSequence < requestedAfterSequence
        stream.timer = setTimeout(() => {
          stream.timer = undefined
          void pollTimelineStream(workId, stream)
        }, catchupPending ? 0 : timelinePollIntervalMs)
      }
    }
  }

  const onTimelinePort = (port: chrome.runtime.Port) => {
    if (port.name !== CONTROL_PLANE_TIMELINE_PORT) return
    let attachedWorkId: string | undefined
    let attachedStream: TimelineStreamState | undefined
    const detach = () => {
      if (!attachedWorkId || !attachedStream) return
      const workId = attachedWorkId
      const stream = attachedStream
      attachedWorkId = undefined
      attachedStream = undefined
      stream.ports.delete(port)
      if (stream.ports.size === 0) releaseTimelineStream(workId, stream)
    }
    port.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return
      const value = message as { type?: unknown; workId?: unknown; afterSequence?: unknown }
      if (value.type !== 'subscribe' || typeof value.workId !== 'string' || typeof value.afterSequence !== 'number' || !Number.isInteger(value.afterSequence) || value.afterSequence < 0) return
      detach()
      let stream = timelineStreams.get(value.workId)
      if (!stream) {
        stream = { ports: new Map(), cursorSequence: value.afterSequence, timer: undefined, polling: false }
        timelineStreams.set(value.workId, stream)
      }
      attachedWorkId = value.workId
      attachedStream = stream
      stream.ports.set(port, value.afterSequence)
      if (value.afterSequence < stream.cursorSequence) {
        stream.cursorSequence = value.afterSequence
        if (stream.timer) {
          clearTimeout(stream.timer)
          stream.timer = undefined
        }
      }
      if (!stream.polling && !stream.timer) void pollTimelineStream(value.workId, stream)
    })
    port.onDisconnect.addListener(detach)
  }

  const runSnapshotOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = snapshotQueue.then(operation, operation)
    snapshotQueue = result.then(() => undefined, () => undefined)
    return result
  }

  const publishState = async (nextSnapshot: ControlPlaneSnapshot | null, nextError: string | null) => {
    const nextFingerprint = nextSnapshot ? JSON.stringify(nextSnapshot) : null
    const changed = nextFingerprint !== snapshotFingerprint || nextError !== state.error
    state = { snapshot: nextSnapshot, error: nextError }
    snapshotFingerprint = nextFingerprint
    void updateBrowserActionStatus(state.snapshot, state.error).catch(() => {})
    if (!changed) return
    await chrome.runtime.sendMessage({
      type: CONTROL_PLANE_SNAPSHOT_MESSAGE,
      snapshot: state.snapshot,
      error: state.error,
    }).catch(() => {})
  }

  const refreshAuthoritativeSnapshot = async (): Promise<ControlPlaneSnapshot> => {
    try {
      const snapshot = await service.getSnapshot()
      await publishState(snapshot, null)
      return snapshot
    } catch (cause) {
      await publishState(state.snapshot, errorMessage(cause))
      throw cause
    }
  }

  const publishMutationSnapshot = async (snapshot: ControlPlaneSnapshot | null): Promise<ControlPlaneSnapshot | null> => {
    if (snapshot) await publishState(snapshot, null)
    return snapshot
  }

  const handleControlPlaneRequest = async (message: ControlPlaneRequestMessage): Promise<unknown> => {
    const args = message.args
    switch (message.method) {
      case 'getSnapshot': return runSnapshotOperation(refreshAuthoritativeSnapshot)
      case 'getWorkDetail': return service.getWorkDetail(args[0] as string)
      case 'getWorkTimelineUpdates': {
        if (!service.getWorkTimelineUpdates) throw new Error('Work timeline updates are unavailable')
        return service.getWorkTimelineUpdates(args[0] as string, args[1] as number)
      }
      case 'releaseWorkTimeline': return service.releaseWorkTimeline?.(args[0] as string)
      case 'getWorkHistoryPage': return service.getWorkHistoryPage(args[0] as string | undefined)
      case 'findWorkByConversation': return service.findWorkByConversation(args[0] as Parameters<AgentHelmServiceAdapter['findWorkByConversation']>[0])
      case 'addWorkspace': return runSnapshotOperation(async () => publishMutationSnapshot(await service.addWorkspace()))
      case 'setCapability': return runSnapshotOperation(async () => publishMutationSnapshot(await service.setCapability(
        args[0] as Parameters<AgentHelmServiceAdapter['setCapability']>[0],
        args[1] as boolean,
      )))
      case 'setAgentEnabled': return runSnapshotOperation(async () => publishMutationSnapshot(await service.setAgentEnabled(args[0] as string, args[1] as boolean)))
      case 'configureTunnel': return runSnapshotOperation(async () => publishMutationSnapshot(await service.configureTunnel(args[0] as Parameters<AgentHelmServiceAdapter['configureTunnel']>[0])))
      case 'setSetting': return runSnapshotOperation(async () => publishMutationSnapshot(await service.setSetting(args[0] as string, args[1] as boolean)))
      case 'installDependency': return runSnapshotOperation(async () => publishMutationSnapshot(await service.installDependency(args[0] as Parameters<AgentHelmServiceAdapter['installDependency']>[0])))
      case 'bindConversation': return runSnapshotOperation(async () => {
        const result = await service.bindConversation(
          args[0] as string,
          args[1] as Parameters<AgentHelmServiceAdapter['bindConversation']>[1],
        )
        await refreshAuthoritativeSnapshot()
        return result
      })
      default: throw new Error(`Unsupported background control-plane method: ${message.method}`)
    }
  }

  const onNotificationClicked = (notificationId: string) => {
    const workId = workIdFromNotificationId(notificationId)
    if (!workId) return
    void (async () => {
      await chrome.storage.session.set({ agentHelmPendingWorkId: workId })
      const openOptions = await prepareSidePanelForCurrentTab()
      await chrome.sidePanel.open(openOptions)
      await chrome.notifications.clear(notificationId)
    })().catch(() => {})
  }

  const onAlarm = (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === ACTION_STATUS_ALARM) void runSnapshotOperation(refreshAuthoritativeSnapshot).catch(() => {})
  }

  const onTabActivated = ({ tabId }: chrome.tabs.OnActivatedInfo) => {
    void chrome.tabs.get(tabId).then(syncPanelForTab).catch(() => {})
  }

  const onTabUpdated = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') return
    void syncPanelForTab(tab).catch(() => {})
  }

  const onWindowRemoved = (windowId: number) => {
    void chrome.storage.session.remove(panelStateKey(windowId)).catch(() => {})
  }

  const onRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | undefined => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return undefined

    if (message.type === CONTROL_PLANE_REQUEST_MESSAGE) {
      void handleControlPlaneRequest(message as ControlPlaneRequestMessage).then(
        (result) => sendResponse({ ok: true, result }),
        (cause) => sendResponse({ ok: false, error: errorMessage(cause) }),
      )
      return true
    }

    if (message.type === OPEN_SIDE_PANEL_MESSAGE) {
      void prepareSidePanelForCurrentTab().then(
        (openOptions) => sendResponse({ ok: true, openOptions }),
        (cause) => sendResponse({ ok: false, error: errorMessage(cause) }),
      )
      return true
    }

    if (message.type === 'agent-helm:refresh-action-status') void runSnapshotOperation(refreshAuthoritativeSnapshot).catch(() => {})
    return undefined
  }

  chrome.notifications.onClicked.addListener(onNotificationClicked)
  chrome.alarms.onAlarm.addListener(onAlarm)
  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.runtime.onConnect?.addListener(onTimelinePort)
  chrome.tabs.onActivated.addListener(onTabActivated)
  chrome.tabs.onUpdated.addListener(onTabUpdated)
  chrome.windows.onRemoved.addListener(onWindowRemoved)
  chrome.alarms.create(ACTION_STATUS_ALARM, { periodInMinutes: 1 })
  void runSnapshotOperation(refreshAuthoritativeSnapshot).catch(() => {})

  return () => {
    chrome.notifications.onClicked.removeListener(onNotificationClicked)
    chrome.alarms.onAlarm.removeListener(onAlarm)
    chrome.runtime.onMessage.removeListener(onRuntimeMessage)
    chrome.runtime.onConnect?.removeListener(onTimelinePort)
    for (const [workId, stream] of [...timelineStreams]) releaseTimelineStream(workId, stream)
    chrome.tabs.onActivated.removeListener(onTabActivated)
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.windows.onRemoved.removeListener(onWindowRemoved)
  }
}
