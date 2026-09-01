import { deriveHelmConnectionHealth } from '@beforewave/agent-helm-ui-contract'

export type ConnectionState = 'connected' | 'unavailable' | 'install-required' | 'error'
export type RuntimeState = 'running' | 'ready' | 'available' | 'stopped' | 'unavailable' | 'error'
export type CapabilityKey = 'understand' | 'code' | 'command'

export interface ConnectionStatus {
  state: ConnectionState
  message?: string
}

export interface CapabilityState {
  enabled: boolean
  available: boolean
}

export type DependencyName = 'serena' | 'tunnelClient'
export type DependencyRuntimeState = 'running' | 'ready' | 'unavailable' | 'disabled'

export interface DependencyProjection {
  state: DependencyRuntimeState
  command: string
  installUrl?: string
  installCommand?: string
}

export type ExtensionConnectionPresentationState = 'connected' | 'disconnected' | 'error'

export interface ExtensionConnectionPresentation {
  state: ExtensionConnectionPresentationState
  issue?: string
}

export function deriveExtensionConnectionPresentation(
  snapshot: ControlPlaneSnapshot | null | undefined,
  requestError?: string | null,
): ExtensionConnectionPresentation {
  const core = snapshot?.settings.find((setting) => setting.id === 'core')
  const tunnel = snapshot?.settings.find((setting) => setting.id === 'tunnel')
  const localAgentLsp = snapshot?.settings.find((setting) => setting.id === 'local-agent-lsp')
  const presentation = deriveHelmConnectionHealth(snapshot ? {
    requestError,
    connection: snapshot.connection,
    core: core ? {
      state: core.state,
      ...(core.enabled === undefined ? {} : { enabled: core.enabled }),
      ...(core.message ? { message: core.message } : {}),
    } : undefined,
    tunnel: tunnel ? {
      state: tunnel.state,
      ...(tunnel.enabled === undefined ? {} : { enabled: tunnel.enabled }),
      ...(tunnel.message ? { message: tunnel.message } : {}),
    } : undefined,
    localMcp: localAgentLsp ? {
      state: localAgentLsp.state,
      ...(localAgentLsp.enabled === undefined ? {} : { enabled: localAgentLsp.enabled }),
      ...(localAgentLsp.message ? { message: localAgentLsp.message } : {}),
    } : undefined,
    agents: snapshot.agents.map((agent) => ({
      name: agent.name,
      enabled: agent.enabled,
      state: agent.runtimeState,
      ...(agent.message ? { message: agent.message } : {}),
    })),
  } : requestError ? { requestError } : undefined)

  if (!presentation.issue) return { state: presentation.state }

  const { issue } = presentation
  if (issue.source === 'request') return { state: presentation.state, issue: issue.message }
  if (issue.source === 'connection') {
    return {
      state: presentation.state,
      issue: issue.message ?? `Agent Helm connection: ${issue.state ?? 'error'}`,
    }
  }
  if (issue.source === 'core') return { state: presentation.state, issue: `${core?.label ?? 'Agent Helm Service'}: ${issue.message ?? issue.state ?? 'error'}` }
  if (issue.source === 'tunnel') return { state: presentation.state, issue: `${tunnel?.label ?? 'Tunnel'}: ${issue.message ?? issue.state ?? 'error'}` }
  if (issue.source === 'localMcp') return { state: presentation.state, issue: `${localAgentLsp?.label ?? 'Local Agent LSP'}: ${issue.message ?? issue.state ?? 'error'}` }
  if (issue.source === 'agent') return { state: presentation.state, issue: `${issue.name ?? 'Agent'}: ${issue.message ?? issue.state ?? 'error'}` }
  return { state: presentation.state, issue: issue.message ?? `${issue.name ?? issue.source}: ${issue.state ?? 'error'}` }
}

export interface AgentState {
  id: string
  name: string
  logo?: string
  enabled: boolean
  configurable: boolean
  runtimeState: RuntimeState
  message?: string
}

export interface SettingProjection {
  id: string
  label: string
  kind: 'toggle' | 'status'
  state: RuntimeState
  enabled?: boolean
  configurable?: boolean
  message?: string
  adminUrl?: string
  logsUrl?: string
  tunnelId?: string
  organizationId?: string
  apiKeyConfigured?: boolean
  dependencyAvailable?: boolean
  installUrl?: string
  missingEnvironment?: string[]
}

export interface WorkspaceProjection {
  id: string
  title: string
  available?: boolean
}

export function workspaceDisplayTitle(workspace: WorkspaceProjection): string {
  return workspace.available === false ? workspace.title + ' · unavailable' : workspace.title
}

export interface WorkHistorySummary {
  id: string
  title: string
  workspaceId?: string
  workspaceLabel?: string
  workspaceTitle?: string
  lastActivityAt: string
  eventCount: number
  chatCount: number
  delegationCount: number
  agentLabel?: string
  runtimeLabel?: string
}

export interface WorkConversationIntent {
  message: string
  task: string
}

export interface WorkBoundConversationIntent {
  intent: WorkConversationIntent
  boundAt: string
}

export interface WorkTimelineItem {
  id: string
  timestamp: string
  actor: 'chatgpt' | 'subagent'
  actorName?: string
  action: string
  primary?: string
  secondary?: string
  status?: string
  durationMs?: number
}

export interface WorkHistoryPage {
  works: WorkHistorySummary[]
  nextCursor?: string
}

export interface WorkHistoryDetail extends WorkHistorySummary {
  createdAt: string
  originIntent?: WorkConversationIntent
  boundIntents: WorkBoundConversationIntent[]
  chatUrls: string[]
  timeline: WorkTimelineItem[]
  localDeepLink?: string | null
}

export interface ControlPlaneSnapshot {
  connection: ConnectionStatus
  capabilities: Record<CapabilityKey, CapabilityState>
  dependencies: Record<DependencyName, DependencyProjection>
  agents: AgentState[]
  settings: SettingProjection[]
  workspaces: WorkspaceProjection[]
  works: WorkHistorySummary[]
  worksNextCursor?: string
}

export interface PageContext {
  kind: 'other' | 'chatgpt' | 'conversation'
  url: string | null
  conversationUrl: string | null
  title: string
  tabId: number | null
  windowId: number | null
  active: boolean
}

export interface WorkNotification {
  workId: string
  title: string
  message: string
}
