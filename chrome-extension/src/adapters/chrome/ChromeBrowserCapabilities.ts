import type { BrowserCapabilities } from '../../models/adapters'
import { t } from '../../locale'
import type { PageContext, WorkNotification } from '../../models/controlPlane'
import { isSupportedLocalDeepLink } from '../../services/deepLink'
import { notificationIdForWork } from '../../services/notifications'
import { pageContextFromTab } from '../../services/pageContext'

export class ChromeBrowserCapabilities implements BrowserCapabilities {
  async getCurrentPageContext(): Promise<PageContext> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) {
      return { kind: 'other', url: null, conversationUrl: null, title: '', tabId: null, windowId: null, active: false }
    }
    return pageContextFromTab(tab)
  }

  subscribePageContext(listener: (context: PageContext) => void): () => void {
    const activated = ({ tabId }: chrome.tabs.OnActivatedInfo) => {
      void chrome.tabs.get(tabId).then((tab) => listener(pageContextFromTab(tab))).catch(() => {})
    }
    const updated = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (!tab.active || (!changeInfo.url && changeInfo.status !== 'complete')) return
      listener(pageContextFromTab(tab))
    }
    chrome.tabs.onActivated.addListener(activated)
    chrome.tabs.onUpdated.addListener(updated)
    return () => {
      chrome.tabs.onActivated.removeListener(activated)
      chrome.tabs.onUpdated.removeListener(updated)
    }
  }

  async openSidePanel(): Promise<void> {
    const current = await chrome.windows.getCurrent()
    if (typeof current.id !== 'number') throw new Error('No active browser window')
    await chrome.sidePanel.open({ windowId: current.id })
  }

  async openExternalUrl(url: string): Promise<void> {
    await chrome.tabs.create({ url })
  }

  async downloadFile(url: string, filename: string): Promise<void> {
    const granted = await chrome.permissions.request({ permissions: ['downloads'] })
    if (!granted) throw new Error('Download permission is required to download Agent Helm Installer')
    await chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'overwrite' })
  }

  async openExpandedDetail(workId: string): Promise<void> {
    const current = await chrome.windows.getCurrent()
    const width = Math.min(980, Math.max(720, (current.width ?? 1120) - 140))
    const height = Math.min(820, Math.max(620, (current.height ?? 900) - 120))
    const left = typeof current.left === 'number' && typeof current.width === 'number'
      ? Math.round(current.left + (current.width - width) / 2)
      : undefined
    const top = typeof current.top === 'number' && typeof current.height === 'number'
      ? Math.round(current.top + (current.height - height) / 2)
      : undefined
    await chrome.windows.create({
      type: 'popup',
      focused: true,
      width,
      height,
      ...(left === undefined ? {} : { left }),
      ...(top === undefined ? {} : { top }),
      url: chrome.runtime.getURL(`expanded.html?workId=${encodeURIComponent(workId)}`),
    })
  }

  async openLocalDeepLink(url: string): Promise<void> {
    if (!isSupportedLocalDeepLink(url)) throw new Error('Unsupported local deep-link')
    await chrome.tabs.create({ url })
  }

  async notifyWork(notification: WorkNotification): Promise<void> {
    await chrome.notifications.create(notificationIdForWork(notification.workId), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('notification-icon.svg'),
      title: notification.title || 'Agent Helm',
      message: notification.message || t('extensionWorkHistoryUpdated'),
    })
  }

  async consumePendingWorkId(): Promise<string | null> {
    const value = await chrome.storage.session.get('agentHelmPendingWorkId')
    const workId = typeof value.agentHelmPendingWorkId === 'string' ? value.agentHelmPendingWorkId : null
    if (workId) await chrome.storage.session.remove('agentHelmPendingWorkId')
    return workId
  }
}
