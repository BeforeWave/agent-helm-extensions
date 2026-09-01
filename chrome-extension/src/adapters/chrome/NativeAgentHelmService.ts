import { t } from '../../locale'
import { normalizeWorkHistorySession, workHistoryTimelinePurpose, type TunnelSetupValues } from '@beforewave/agent-helm-ui-contract'
import { createWorkHistorySessionDetailModel, createWorkHistorySessionListItem, workHistoryTimelineExecutionDetail, WORK_HISTORY_PAGE_SIZE } from '../../models/workHistory'
import type { AgentHelmServiceAdapter } from '../../models/adapters'
import type { CapabilityKey, ControlPlaneSnapshot, DependencyName, PageContext, WorkHistoryDetail } from '../../models/controlPlane'
import { NativeMessagingTransport } from './NativeMessagingTransport'

import type { DependencyProjection, RuntimeState, WorkHistoryPage, WorkHistorySummary, WorkTimelineItem, WorkspaceProjection } from '../../models/controlPlane'

import type { NativeDaemonProbe } from './NativeMessagingTransport'

import { normalizeChatGPTConversationUrl } from '../../services/pageContext'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function runtimeStateFromAdapter(health: Record<string, unknown>, coreEnabled: boolean): RuntimeState {
  if (!coreEnabled) return 'stopped'
  return health.status === 'error' ? 'error' : 'ready'
}

function projectDependency(value: unknown, fallbackCommand: string, running = false): DependencyProjection {
  const dependency = record(value)
  const configured = dependency.configured === true
  const available = dependency.available === true
  const install = record(dependency.install)
  const installUrl = stringValue(install.url)
  const installCommand = install.automatic === true ? stringValue(install.command) : undefined
  return {
    state: !configured ? 'disabled' : running ? 'running' : available ? 'ready' : 'unavailable',
    command: stringValue(dependency.command) ?? fallbackCommand,
    ...(installUrl ? { installUrl } : {}),
    ...(installCommand ? { installCommand } : {}),
  }
}

function projectWorkSummary(value: unknown): WorkHistorySummary | undefined {
  const session = normalizeWorkHistorySession(value)
  if (!session) return undefined
  const item = createWorkHistorySessionListItem(session)
  return {
    id: item.id,
    title: item.title,
    ...(item.workspaceId ? { workspaceId: item.workspaceId } : {}),
    ...(item.workspaceLabel ? { workspaceLabel: item.workspaceLabel, workspaceTitle: item.workspaceLabel } : {}),
    lastActivityAt: item.lastActivityAt,
    eventCount: item.eventCount,
    chatCount: item.chatCount,
    delegationCount: item.delegationCount,
    ...(session.agentLabel ? { agentLabel: session.agentLabel } : {}),
    ...(session.runtimeLabel ? { runtimeLabel: session.runtimeLabel } : {}),
  }
}


function projectTimeline(value: unknown): WorkTimelineItem | undefined {
  const item = record(value)
  const id = stringValue(item.id)
  const timestamp = stringValue(item.timestamp)
  if (!id || !timestamp) return undefined
  const actor = item.actor === 'subagent' ? 'subagent' : 'chatgpt'
  const error = record(item.error)
  const primary = workHistoryTimelineExecutionDetail(item) ?? stringValue(item.title)
  const secondary = stringValue(error.message) ?? stringValue(item.requirement) ?? stringValue(item.message)
  const status = stringValue(item.status)
  const durationMs = typeof item.durationMs === 'number' && Number.isFinite(item.durationMs) ? item.durationMs : undefined
  const purpose = workHistoryTimelinePurpose(item)
  return {
    id,
    timestamp,
    actor,
    ...(stringValue(item.actorName) ? { actorName: stringValue(item.actorName)! } : {}),
    action: purpose ?? stringValue(item.actionType) ?? stringValue(item.kind) ?? 'activity',
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
    ...(status ? { status } : {}),
    ...(durationMs === undefined ? {} : { durationMs }),
  }
}

export function projectNativeSnapshot(healthValue: unknown, summariesValue: unknown, workspacesValue: unknown = [], worksNextCursor?: string): ControlPlaneSnapshot {
  const health = record(healthValue)
  const coreServiceEnabled = health.status !== 'disabled'
  const coreRunning = typeof health.running === 'boolean' ? health.running : coreServiceEnabled
  const lifecycle = record(health.clientLifecycle)
  const coreConfigurable = booleanValue(lifecycle.configurable)
  const policy = record(health.externalCapabilities)
  const access = record(health.externalUserAccess)
  const supportsUnderstand = booleanValue(policy.command) || booleanValue(policy.semantic)
  const supportsCode = supportsUnderstand && !booleanValue(policy.read_only)
  const supportsCommand = booleanValue(policy.delegate)
  const understandEnabled = booleanValue(access.enabled)
  const codeEnabled = understandEnabled && booleanValue(access.mutations) && supportsCode
  const commandEnabled = understandEnabled && booleanValue(access.delegation) && supportsCommand

  const tunnel = record(health.tunnel)
  const missingEnvironment = stringArray(tunnel.missingEnvironment)
  const tunnelError = record(tunnel.error)
  const tunnelErrorMessage = stringValue(tunnelError.message)
  let tunnelState: RuntimeState = 'unavailable'
  if (tunnelErrorMessage || tunnel.reason === 'missing-env') tunnelState = 'error'
  else if (typeof tunnel.running === 'boolean') tunnelState = tunnel.running ? 'running' : 'stopped'
  else if (tunnel.reason === 'disabled' || tunnel.reason === 'core-disabled') tunnelState = 'stopped'
  const tunnelMessage = tunnelErrorMessage ?? (missingEnvironment.length > 0
    ? "Missing required environment: " + missingEnvironment.join(", ")
    : undefined)

  const localMcp = record(health.localMcp)
  const localMcpEnabled = coreRunning && booleanValue(localMcp.enabled)
  const localMcpMessage = stringValue(localMcp.message)
  const dependencyHealth = record(health.dependencies)
  const dependencies = {
    serena: projectDependency(dependencyHealth.serena, 'serena', booleanValue(record(health.serena).connected)),
    tunnelClient: projectDependency(dependencyHealth.tunnelClient, 'tunnel-client', booleanValue(tunnel.running)),
  }
  const tunnelClientAvailable = dependencies.tunnelClient.state === 'ready' || dependencies.tunnelClient.state === 'running'

  const adapters = Array.isArray(health.adapters) ? health.adapters : []
  const agents = adapters.map((value) => {
    const adapter = record(value)
    const adapterHealth = record(adapter.health)
    const id = stringValue(adapter.id) ?? 'agent'
    const name = stringValue(adapter.displayName) ?? id
    const message = stringValue(adapterHealth.error) ?? stringValue(adapterHealth.message)
    return {
      id,
      name,
      ...(id === 'dsh' ? { logo: 'DSH' } : {}),
      enabled: booleanValue(adapter.delegationEnabled),
      configurable: true,
      runtimeState: runtimeStateFromAdapter(adapterHealth, coreRunning),
      ...(message ? { message } : {}),
    }
  })

  const summaries = Array.isArray(summariesValue) ? summariesValue : []
  const works = summaries.map(projectWorkSummary).filter((item): item is WorkHistorySummary => Boolean(item))
  const workspaceMap = new Map<string, WorkspaceProjection>()
  const authoritativeWorkspaces = Array.isArray(workspacesValue) ? workspacesValue : []
  for (const value of authoritativeWorkspaces) {
    const workspace = record(value)
    const id = stringValue(workspace.id)
    if (!id) continue
    workspaceMap.set(id, { id, title: stringValue(workspace.title) ?? id, available: workspace.available !== false })
  }
  for (const work of works) {
    if (!work.workspaceId || workspaceMap.has(work.workspaceId)) continue
    workspaceMap.set(work.workspaceId, { id: work.workspaceId, title: work.workspaceTitle ?? work.workspaceId })
  }
  const serena = record(health.serena)
  const runtimes = Array.isArray(serena.runtimes) ? serena.runtimes : []
  for (const value of runtimes) {
    const runtime = record(value)
    const id = stringValue(runtime.workspaceId)
    if (id && !workspaceMap.has(id)) workspaceMap.set(id, { id, title: id })
  }

  return {
    connection: { state: 'connected' },
    capabilities: {
      understand: { enabled: understandEnabled, available: supportsUnderstand },
      code: { enabled: codeEnabled, available: supportsCode },
      command: { enabled: commandEnabled, available: supportsCommand },
    },
    dependencies,
    agents,
    settings: [
      {
        id: 'local-agent-lsp',
        label: t('localMcp'),
        kind: 'toggle',
        enabled: localMcpEnabled,
        configurable: true,
        state: localMcpEnabled ? 'running' : 'stopped',
        ...(localMcpMessage ? { message: localMcpMessage } : {}),
      },
      {
        id: 'tunnel',
        label: t('tunnel'),
        kind: 'status',
        state: tunnelState,
        ...(tunnelMessage ? { message: tunnelMessage } : {}),
        ...(missingEnvironment.length > 0 ? { missingEnvironment } : {}),
        ...(stringValue(tunnel.tunnelId) ? { tunnelId: stringValue(tunnel.tunnelId)! } : {}),
        ...(stringValue(tunnel.organizationId) ? { organizationId: stringValue(tunnel.organizationId)! } : {}),
        apiKeyConfigured: booleanValue(tunnel.apiKeyConfigured),
        dependencyAvailable: tunnelClientAvailable,
        ...(dependencies.tunnelClient.state === 'unavailable' && dependencies.tunnelClient.installUrl ? { installUrl: dependencies.tunnelClient.installUrl } : {}),
        ...(stringValue(tunnel.adminUrl) ? { adminUrl: stringValue(tunnel.adminUrl)! } : {}),
        ...(stringValue(tunnel.logsUrl) ? { logsUrl: stringValue(tunnel.logsUrl)! } : {}),
      },
      {
        id: 'core',
        label: t('core'),
        kind: 'toggle',
        enabled: coreServiceEnabled,
        configurable: coreConfigurable,
        state: coreRunning ? 'running' : 'stopped',
      },
    ],
    workspaces: [...workspaceMap.values()],
    works,
    ...(worksNextCursor ? { worksNextCursor } : {}),
  }
}

export class ServiceContractUnavailableError extends Error {
  constructor() {
    super(t('extensionServiceContractUnavailable'))
    this.name = 'ServiceContractUnavailableError'
  }
}

function unavailableSnapshot(
  connection: ControlPlaneSnapshot['connection'],
  daemonProbe?: NativeDaemonProbe,
): ControlPlaneSnapshot {
  const bootstrapReady = connection.state === 'connected'
  const attachIssue = daemonProbe && (daemonProbe.reason === 'attach-failed' || daemonProbe.reason === 'incompatible-daemon')
    ? daemonProbe.error ?? `Failed to attach Agent Helm daemon at ${daemonProbe.socket}.`
    : undefined
  const daemonKnownRunning = Boolean(daemonProbe && daemonProbe.reason !== 'not-running')
  const serviceState: RuntimeState = bootstrapReady
    ? attachIssue ? 'error' : 'stopped'
    : 'unavailable'
  const dependentState: RuntimeState = bootstrapReady && !attachIssue ? 'stopped' : 'unavailable'
  return {
    connection,
    capabilities: {
      understand: { enabled: false, available: false },
      code: { enabled: false, available: false },
      command: { enabled: false, available: false },
    },
    dependencies: {
      serena: { state: 'unavailable', command: 'serena' },
      tunnelClient: { state: 'unavailable', command: 'tunnel-client' },
    },
    agents: [],
    settings: [
      {
        id: 'local-agent-lsp',
        label: t('localMcp'),
        kind: 'toggle',
        enabled: false,
        configurable: false,
        state: dependentState,
      },
      { id: 'tunnel', label: t('tunnel'), kind: 'status', state: dependentState },
      {
        id: 'core',
        label: t('core'),
        kind: 'toggle',
        enabled: daemonKnownRunning,
        configurable: bootstrapReady && !attachIssue,
        state: serviceState,
        ...(attachIssue ? { message: attachIssue } : {}),
      },
    ],
    workspaces: [],
    works: [],
  }
}

export class NativeAgentHelmService implements AgentHelmServiceAdapter {
  constructor(private readonly transport: NativeMessagingTransport) {}

  async getSnapshot(): Promise<ControlPlaneSnapshot> {
    let health: Record<string, unknown>
    try {
      health = await this.transport.request<Record<string, unknown>>('supervisorHealth')
    } catch (error) {
      const healthError = error instanceof Error ? error.message : String(error)
      if (/Native Messaging request timed out/i.test(healthError)) {
        return unavailableSnapshot({ state: 'unavailable', message: healthError })
      }
      try {
        const daemonProbe = await this.transport.daemonProbe()
        return unavailableSnapshot({ state: 'connected' }, daemonProbe)
      } catch {
        return unavailableSnapshot(await this.transport.probe())
      }
    }

    const [summariesResult, workspacesResult] = await Promise.allSettled([
      this.transport.request<Record<string, unknown>>('listChatSessionSummaryPage', [undefined, WORK_HISTORY_PAGE_SIZE]),
      this.transport.request<unknown[]>('listWorkspaces'),
    ])
    const page = summariesResult.status === 'fulfilled' ? record(summariesResult.value) : {}
    const summaries = Array.isArray(page.sessions) ? page.sessions : []
    const nextCursor = stringValue(page.nextCursor)
    const workspaces = workspacesResult.status === 'fulfilled' ? workspacesResult.value : []
    return projectNativeSnapshot(health, summaries, workspaces, nextCursor)
  }

  async getWorkHistoryPage(cursor?: string): Promise<WorkHistoryPage> {
    const value = await this.transport.request<Record<string, unknown>>('listChatSessionSummaryPage', [cursor, WORK_HISTORY_PAGE_SIZE])
    const page = record(value)
    const summaries = Array.isArray(page.sessions) ? page.sessions : []
    const works = summaries.map(projectWorkSummary).filter((item): item is WorkHistorySummary => Boolean(item))
    const nextCursor = stringValue(page.nextCursor)
    return { works, ...(nextCursor ? { nextCursor } : {}) }
  }

  async findWorkByConversation(pageContext: PageContext): Promise<WorkHistorySummary | null> {
    const conversationUrl = normalizeChatGPTConversationUrl(pageContext.conversationUrl ?? pageContext.url ?? '')
    if (!conversationUrl) return null
    const value = await this.transport.request<unknown>('findChatSessionSummaryByUrl', [conversationUrl])
    const session = normalizeWorkHistorySession(value)
    return session ? projectWorkSummary(session) ?? null : null
  }

  async getWorkDetail(workId: string): Promise<WorkHistoryDetail> {
    const [summaryValue, timelineValue] = await Promise.all([
      this.transport.request<unknown>('getChatSessionSummary', [workId]),
      this.transport.request<unknown[]>('getChatSessionTimeline', [workId]),
    ])
    const session = normalizeWorkHistorySession(summaryValue)
    if (!session) throw new Error(`Unknown Work History record: ${workId}`)
    const projected = projectWorkSummary(session)!
    const detail = createWorkHistorySessionDetailModel(session)
    const timeline = Array.isArray(timelineValue)
      ? timelineValue.map(projectTimeline).filter((item): item is WorkTimelineItem => Boolean(item))
      : []
    return {
      ...projected,
      createdAt: detail.createdAt || projected.lastActivityAt,
      ...(detail.originIntent ? { originIntent: detail.originIntent } : {}),
      boundIntents: detail.boundIntents,
      chatUrls: detail.chatUrls,
      timeline,
    }
  }

  async addWorkspace(): Promise<ControlPlaneSnapshot | null> {
    const result = await this.transport.request<{ cancelled?: boolean }>('chooseAndRegisterWorkspace', [], null)
    if (result.cancelled) return null
    return await this.getSnapshot()
  }

  async setCapability(capability: CapabilityKey, enabled: boolean): Promise<ControlPlaneSnapshot> {
    const current = record(await this.transport.request<unknown>('getExternalUserAccess'))
    const next = {
      enabled: booleanValue(current.enabled),
      mutations: booleanValue(current.mutations),
      delegation: booleanValue(current.delegation),
    }
    if (capability === 'understand') next.enabled = enabled
    else if (capability === 'code') next.mutations = enabled
    else next.delegation = enabled
    await this.transport.request('setExternalUserAccess', [next])
    return await this.getSnapshot()
  }

  async setAgentEnabled(agentId: string, enabled: boolean): Promise<ControlPlaneSnapshot> {
    await this.transport.request('setAgentDelegationEnabled', [agentId, enabled])
    return await this.getSnapshot()
  }

  async configureTunnel(input: TunnelSetupValues): Promise<ControlPlaneSnapshot> {
    await this.transport.request('configureTunnel', [input], 30_000)
    return await this.getSnapshot()
  }

  async setSetting(settingId: string, enabled: boolean): Promise<ControlPlaneSnapshot> {
    if (settingId === 'core') await this.transport.request('setDaemonEnabled', [enabled], 30_000)
    else if (settingId === 'local-agent-lsp') await this.transport.request('setLocalMcpEnabled', [enabled])
    else throw new Error(`Setting is not writable: ${settingId}`)
    return await this.getSnapshot()
  }

  async installDependency(dependency: DependencyName): Promise<ControlPlaneSnapshot> {
    await this.transport.request('installDependency', [dependency], 6 * 60_000)
    return await this.getSnapshot()
  }

  async bindConversation(workId: string, pageContext: PageContext): Promise<WorkHistoryDetail> {
    const conversationUrl = normalizeChatGPTConversationUrl(pageContext.conversationUrl ?? pageContext.url ?? '')
    if (!conversationUrl) throw new Error('Current tab is not a ChatGPT conversation')
    await this.transport.request('bindChatUrl', [workId, conversationUrl])
    return await this.getWorkDetail(workId)
  }
}
