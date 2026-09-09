import type { BrowserCapabilities, BrowserSettingsSection } from '../../models/adapters'
import type { PageContext, WorkNotification } from '../../models/controlPlane'
import { classifyChatGPTPage } from '../../services/pageContext'
import { isSupportedLocalDeepLink } from '../../services/deepLink'

function createPageContext(url: string, title = 'ChatGPT'): PageContext {
  return {
    ...classifyChatGPTPage(url),
    title,
    tabId: 1,
    windowId: 1,
    active: true,
  }
}

export type MockBrowserCapabilitiesOptions = {
  onOpenSidePanel?: (section?: BrowserSettingsSection) => void
  onOpenExpandedDetail?: (workId: string) => void
}

export class MockBrowserCapabilities implements BrowserCapabilities {
  private context: PageContext = createPageContext('https://chatgpt.com/c/preview-conversation', 'Preview conversation')
  private readonly listeners = new Set<(context: PageContext) => void>()
  pendingWorkId: string | null = null
  pendingSettingsSection: BrowserSettingsSection | null = null
  lastNotification: WorkNotification | null = null
  expandedWorkId: string | null = null
  sidePanelOpened = false
  lastDownload: { url: string; filename: string } | null = null

  constructor(private readonly options: MockBrowserCapabilitiesOptions = {}) {}

  setPageUrl(url: string, title = 'Preview page'): void {
    this.context = createPageContext(url, title)
    for (const listener of this.listeners) listener(structuredClone(this.context))
  }

  async getCurrentPageContext(): Promise<PageContext> {
    return structuredClone(this.context)
  }

  subscribePageContext(listener: (context: PageContext) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async openSidePanel(section?: BrowserSettingsSection): Promise<void> {
    this.pendingSettingsSection = section ?? null
    this.sidePanelOpened = true
    this.options.onOpenSidePanel?.(section)
  }

  closePopup(): void {}

  async openExternalUrl(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async downloadFile(url: string, filename: string): Promise<void> {
    this.lastDownload = { url, filename }
  }

  async openExpandedDetail(workId: string): Promise<void> {
    this.expandedWorkId = workId
    this.options.onOpenExpandedDetail?.(workId)
  }

  async openLocalDeepLink(url: string): Promise<void> {
    if (!isSupportedLocalDeepLink(url)) throw new Error('Unsupported local deep-link')
  }

  async notifyWork(notification: WorkNotification): Promise<void> {
    this.lastNotification = structuredClone(notification)
  }

  async consumePendingWorkId(): Promise<string | null> {
    const value = this.pendingWorkId
    this.pendingWorkId = null
    return value
  }

  async consumePendingSettingsSection(): Promise<BrowserSettingsSection | null> {
    const value = this.pendingSettingsSection
    this.pendingSettingsSection = null
    return value
  }
}
