import { workIdFromNotificationId } from '../../services/notifications'

import { createChromeControlPlaneClient } from '../../client/factories'
import { deriveExtensionConnectionPresentation, type ExtensionConnectionPresentationState } from '../../models/controlPlane'

const ACTION_STATUS_ALARM = 'agent-helm-action-status'

const backgroundControlPlaneClient = createChromeControlPlaneClient()

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

async function refreshBrowserActionStatus(): Promise<void> {
  try {
    const snapshot = await backgroundControlPlaneClient.getSnapshot()
    const presentation = deriveExtensionConnectionPresentation(snapshot)
    await chrome.action.setIcon({
      imageData: {
        16: createPlugImageData(16, presentation.state),
        32: createPlugImageData(32, presentation.state),
      },
    })
  } catch (cause) {
    const presentation = deriveExtensionConnectionPresentation(
      null,
      cause instanceof Error ? cause.message : String(cause),
    )
    await chrome.action.setIcon({
      imageData: {
        16: createPlugImageData(16, presentation.state),
        32: createPlugImageData(32, presentation.state),
      },
    })
  }
}

export function installBackgroundHandlers(): () => void {
  const onNotificationClicked = (notificationId: string) => {
    const workId = workIdFromNotificationId(notificationId)
    if (!workId) return
    void (async () => {
      await chrome.storage.session.set({ agentHelmPendingWorkId: workId })
      const current = await chrome.windows.getCurrent()
      if (typeof current.id === 'number') await chrome.sidePanel.open({ windowId: current.id })
      await chrome.notifications.clear(notificationId)
    })().catch(() => {})
  }

  const onAlarm = (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === ACTION_STATUS_ALARM) void refreshBrowserActionStatus().catch(() => {})
  }

  const onRuntimeMessage = (message: unknown) => {
    if (
      typeof message === 'object'
      && message !== null
      && 'type' in message
      && message.type === 'agent-helm:refresh-action-status'
    ) {
      void refreshBrowserActionStatus().catch(() => {})
    }
  }

  chrome.notifications.onClicked.addListener(onNotificationClicked)
  chrome.alarms.onAlarm.addListener(onAlarm)
  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.alarms.create(ACTION_STATUS_ALARM, { periodInMinutes: 1 })
  void refreshBrowserActionStatus().catch(() => {})

  return () => {
    chrome.notifications.onClicked.removeListener(onNotificationClicked)
    chrome.alarms.onAlarm.removeListener(onAlarm)
    chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  }
}
