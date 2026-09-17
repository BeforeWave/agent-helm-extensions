import type { BrowserCapabilities, BrowserSettingsSection } from '../../models/adapters'
import type { PageContext, WorkNotification } from '../../models/controlPlane'
import { classifyChatGPTPage } from '../../services/pageContext'
import { isSupportedLocalDeepLink } from '../../services/deepLink'

function pageContext(url: string, title = 'Standalone page'): PageContext {
  return {
    ...classifyChatGPTPage(url),
    title,
    tabId: 1,
    windowId: 1,
    active: true,
  }
}

export interface StandaloneBrowserCapabilitiesOptions {
  initialPageUrl?: string
  onOpenSidePanel?: (section?: BrowserSettingsSection) => void
  onOpenExpandedDetail?: (workId: string) => void
}

export class StandaloneBrowserCapabilities implements BrowserCapabilities {
  private context: PageContext
  private readonly listeners = new Set<(context: PageContext) => void>()
  private pendingWorkId: string | null = null
  private pendingSettingsSection: BrowserSettingsSection | null = null

  constructor(private readonly options: StandaloneBrowserCapabilitiesOptions = {}) {
    this.context = pageContext(options.initialPageUrl || 'https://chatgpt.com/')
  }

  setPageUrl(url: string): void {
    this.context = pageContext(url)
    for (const listener of this.listeners) listener(structuredClone(this.context))
  }

  async getCurrentPageContext(): Promise<PageContext> { return structuredClone(this.context) }
  subscribePageContext(listener: (context: PageContext) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async openSidePanel(section?: BrowserSettingsSection): Promise<void> {
    this.pendingSettingsSection = section ?? null
    this.options.onOpenSidePanel?.(section)
  }

  closePopup(): void {}
  async openExternalUrl(url: string): Promise<void> { window.open(url, '_blank', 'noopener,noreferrer') }
  async downloadFile(url: string, filename: string): Promise<void> {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener noreferrer'
    anchor.click()
  }

  async openExpandedDetail(workId: string): Promise<void> {
    this.pendingWorkId = workId
    this.options.onOpenExpandedDetail?.(workId)
  }

  async openLocalDeepLink(url: string): Promise<void> {
    if (!isSupportedLocalDeepLink(url)) throw new Error('Unsupported local deep-link')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async notifyWork(notification: WorkNotification): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(notification.title, { body: notification.message })
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
