import type { TunnelSetupValues } from '@beforewave/agent-helm-ui-contract'
import type { AgentHelmServiceAdapter, BrowserCapabilities } from '../models/adapters'
import type { CapabilityKey, DependencyName, PageContext, WorkNotification } from '../models/controlPlane'

export class BrowserControlPlaneClient {
  constructor(
    private readonly service: AgentHelmServiceAdapter,
    private readonly browser: BrowserCapabilities,
  ) {}

  getSnapshot() { return this.service.getSnapshot() }
  getWorkDetail(workId: string) { return this.service.getWorkDetail(workId) }
  getWorkHistoryPage(cursor?: string) { return this.service.getWorkHistoryPage(cursor) }
  findWorkByConversation(pageContext: PageContext) { return this.service.findWorkByConversation(pageContext) }
  addWorkspace() { return this.service.addWorkspace() }
  setCapability(capability: CapabilityKey, enabled: boolean) { return this.service.setCapability(capability, enabled) }
  setAgentEnabled(agentId: string, enabled: boolean) { return this.service.setAgentEnabled(agentId, enabled) }
  configureTunnel(input: TunnelSetupValues) { return this.service.configureTunnel(input) }

  setSetting(settingId: string, enabled: boolean) { return this.service.setSetting(settingId, enabled) }
  installDependency(dependency: DependencyName) { return this.service.installDependency(dependency) }
  bindConversation(workId: string, pageContext: PageContext) { return this.service.bindConversation(workId, pageContext) }

  getCurrentPageContext() { return this.browser.getCurrentPageContext() }
  subscribePageContext(listener: (context: PageContext) => void) { return this.browser.subscribePageContext(listener) }
  openSidePanel() { return this.browser.openSidePanel() }
  openExternalUrl(url: string) { return this.browser.openExternalUrl(url) }
  downloadFile(url: string, filename: string) { return this.browser.downloadFile(url, filename) }
  openExpandedDetail(workId: string) { return this.browser.openExpandedDetail(workId) }
  openLocalDeepLink(url: string) { return this.browser.openLocalDeepLink(url) }
  notifyWork(notification: WorkNotification) { return this.browser.notifyWork(notification) }
  consumePendingWorkId() { return this.browser.consumePendingWorkId() }
}
