import type { TunnelSetupValues } from '../ui-contract'
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

export type ExternalMcpServer = {
  id: string
  name: string
  source: string
  sources?: Array<{ source: string; name: string }>
  status: 'discovered' | 'imported' | 'enabled' | 'connected' | 'unavailable' | 'auth-required' | 'needs-config' | 'error'
  issue?: 'missing-env' | 'remote-auth' | 'insecure-http'
  requiredEnv?: string[]
  canConfigureHeaders?: boolean
  canAuthorize?: boolean
  authenticated?: boolean
}

export type ExternalMcpScanResult = {
  servers: ExternalMcpServer[]
  failures: Array<{ source: 'codex' | 'claude'; reason: 'scan_failed' | 'invalid_response' }>
}

export type OAuthClientSetup = { grantType: 'authorization_code' | 'client_credentials'; clientId?: string; clientSecret?: string; clientMetadataUrl?: string; scope?: string }

export interface AgentHelmServiceAdapter {
  subscribeSnapshot?(listener: (update: ControlPlaneStateUpdate) => void): () => void
  subscribeWorkHistoryChanges?(listener: () => void): () => void
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
  listExternalMcpServers(): Promise<ExternalMcpServer[]>
  scanExternalMcpServers(): Promise<ExternalMcpScanResult>
  importExternalMcpServer(id: string): Promise<ExternalMcpServer[]>
  configureExternalMcpEnv(id: string, values: Record<string, string>): Promise<ExternalMcpServer[]>
  configureExternalMcpHttpHeaders(id: string, headers: Record<string, string>): Promise<ExternalMcpServer[]>
  configureExternalMcpOAuth(id: string, options: OAuthClientSetup): Promise<ExternalMcpServer[]>
  beginExternalMcpOAuth(id: string): Promise<{ authorizationUrl?: string }>
  setExternalMcpEnabled(id: string, enabled: boolean): Promise<ExternalMcpServer[]>
  configureTunnel(input: TunnelSetupValues): Promise<ControlPlaneSnapshot>
  setSetting(settingId: string, enabled: boolean): Promise<ControlPlaneSnapshot>
  installDependency(dependency: DependencyName): Promise<ControlPlaneSnapshot>
  bindConversation(workId: string, pageContext: PageContext): Promise<WorkHistoryDetail>
}

export type BrowserSettingsSection = 'agents' | 'tunnel' | 'external-mcp'

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
