import type { TunnelSetupValues } from '@beforewave/agent-helm-ui-contract'
import type {
  CapabilityKey,
  ControlPlaneSnapshot,
  DependencyName,
  PageContext,
  WorkHistoryDetail,
  WorkHistoryPage,
  WorkHistorySummary,
  WorkNotification,
} from './controlPlane'

export interface AgentHelmServiceAdapter {
  getSnapshot(): Promise<ControlPlaneSnapshot>
  getWorkDetail(workId: string): Promise<WorkHistoryDetail>
  getWorkHistoryPage(cursor?: string): Promise<WorkHistoryPage>
  findWorkByConversation(pageContext: PageContext): Promise<WorkHistorySummary | null>
  addWorkspace(): Promise<ControlPlaneSnapshot | null>
  setCapability(capability: CapabilityKey, enabled: boolean): Promise<ControlPlaneSnapshot>
  setAgentEnabled(agentId: string, enabled: boolean): Promise<ControlPlaneSnapshot>
  configureTunnel(input: TunnelSetupValues): Promise<ControlPlaneSnapshot>
  setSetting(settingId: string, enabled: boolean): Promise<ControlPlaneSnapshot>
  installDependency(dependency: DependencyName): Promise<ControlPlaneSnapshot>
  bindConversation(workId: string, pageContext: PageContext): Promise<WorkHistoryDetail>
}

export interface BrowserCapabilities {
  getCurrentPageContext(): Promise<PageContext>
  subscribePageContext(listener: (context: PageContext) => void): () => void
  openSidePanel(): Promise<void>
  openExternalUrl(url: string): Promise<void>
  downloadFile(url: string, filename: string): Promise<void>
  openExpandedDetail(workId: string): Promise<void>
  openLocalDeepLink(url: string): Promise<void>
  notifyWork(notification: WorkNotification): Promise<void>
  consumePendingWorkId(): Promise<string | null>
}
