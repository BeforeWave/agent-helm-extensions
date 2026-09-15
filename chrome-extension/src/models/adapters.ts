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
  WorkTimelineItem,
  WorkTimelineUpdateBatch,
} from './controlPlane'

export interface ControlPlaneStateUpdate {
  snapshot: ControlPlaneSnapshot | null
  error: string | null
}

export interface AgentHelmServiceAdapter {
  subscribeSnapshot?(listener: (update: ControlPlaneStateUpdate) => void): () => void
  getSnapshot(): Promise<ControlPlaneSnapshot>
  getWorkDetail(workId: string): Promise<WorkHistoryDetail>
  getWorkTimelineUpdates?(workId: string, afterSequence: number): Promise<WorkTimelineUpdateBatch>
  releaseWorkTimeline?(workId: string): Promise<void>
  subscribeWorkTimeline?(workId: string, afterSequence: number, onUpdates: (updates: WorkTimelineItem[]) => void, onError?: (error: Error) => void): () => void
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

export type BrowserSettingsSection = 'agents' | 'tunnel'

export interface BrowserCapabilities {
  getCurrentPageContext(): Promise<PageContext>
  subscribePageContext(listener: (context: PageContext) => void): () => void
  openSidePanel(section?: BrowserSettingsSection): Promise<void>
  closePopup(): void
  openExternalUrl(url: string): Promise<void>
  downloadFile(url: string, filename: string): Promise<void>
  openExpandedDetail(workId: string): Promise<void>
  openLocalDeepLink(url: string): Promise<void>
  notifyWork(notification: WorkNotification): Promise<void>
  consumePendingWorkId(): Promise<string | null>
  consumePendingSettingsSection(): Promise<BrowserSettingsSection | null>
}
