import type { TunnelSetupValues } from '@beforewave/agent-helm-ui-contract'
import type { AgentHelmServiceAdapter } from '../../models/adapters'
import type {
  CapabilityKey,
  ControlPlaneSnapshot,
  DependencyName,
  PageContext,
  WorkHistoryDetail,
  WorkHistorySummary,
} from '../../models/controlPlane'
import { normalizeChatGPTConversationUrl } from '../../services/pageContext'

function clone<T>(value: T): T {
  return structuredClone(value)
}

const works: WorkHistorySummary[] = [
  {
    id: 'work-browser-extension',
    title: 'Implement Browser Extension Phase 1',
    workspaceId: 'workspace-agent-helm',
    workspaceLabel: 'example-project',
    workspaceTitle: 'example-project',
    lastActivityAt: '2026-08-28T11:30:00.000Z',
    eventCount: 9,
    chatCount: 1,
    delegationCount: 0,
    agentLabel: 'ChatGPT',
    runtimeLabel: 'Direct work',
  },
  {
    id: 'work-tunnel-errors',
    title: 'Surface Tunnel runtime errors',
    workspaceId: 'workspace-agent-helm',
    workspaceLabel: 'example-project',
    workspaceTitle: 'example-project',
    lastActivityAt: '2026-08-28T04:34:00.000Z',
    eventCount: 5,
    chatCount: 2,
    delegationCount: 1,
    agentLabel: 'DSH',
    runtimeLabel: 'Native session',
  },
  {
    id: 'work-forma',
    title: 'Inspect workspace state',
    workspaceId: 'workspace-forma',
    workspaceLabel: 'forma',
    workspaceTitle: 'forma',
    lastActivityAt: '2026-08-27T08:20:00.000Z',
    eventCount: 3,
    chatCount: 1,
    delegationCount: 0,
    agentLabel: 'ChatGPT',
    runtimeLabel: 'Direct work',
  },
]

function makeDetail(summary: WorkHistorySummary, originUrl: string, task: string): WorkHistoryDetail {
  return {
    ...summary,
    createdAt: '2026-08-28T09:00:00.000Z',
    originIntent: {
      message: summary.title,
      task,
    },
    boundIntents: [],
    chatUrls: [originUrl],
    timeline: [
      {
        id: `${summary.id}:inspect`,
        timestamp: '2026-08-28T09:05:00.000Z',
        actor: 'chatgpt',
        actorName: 'ChatGPT',
        action: 'Inspect',
        primary: summary.workspaceTitle ?? 'Workspace',
        secondary: 'Current implementation',
      },
      {
        id: `${summary.id}:activity`,
        timestamp: summary.lastActivityAt,
        actor: summary.delegationCount ? 'subagent' : 'chatgpt',
        actorName: summary.delegationCount ? 'DSH' : 'ChatGPT',
        action: summary.delegationCount ? 'Status update' : 'Edit',
        primary: summary.title,
        secondary: summary.runtimeLabel,
      },
    ],
    localDeepLink: null,
  }
}

export class MockAgentHelmService implements AgentHelmServiceAdapter {
  private snapshot: ControlPlaneSnapshot = {
    connection: { state: 'connected', message: 'Mock Agent Helm service' },
    capabilities: {
      understand: { enabled: true, available: true },
      code: { enabled: true, available: true },
      command: { enabled: false, available: true },
    },
    dependencies: {
      serena: { state: 'ready', command: 'serena', installUrl: 'https://github.com/oraios/serena' },
      tunnelClient: { state: 'running', command: 'tunnel-client', installUrl: 'https://github.com/openai/tunnel-client/releases' },
    },
    agents: [
      { id: 'dsh', name: 'DSH', logo: 'DSH', enabled: true, configurable: true, runtimeState: 'ready' },
    ],
    settings: [
      { id: 'local-agent-lsp', label: 'Local Agent LSP', kind: 'toggle', enabled: true, configurable: true, state: 'running' },
      { id: 'tunnel', label: 'Tunnel', kind: 'status', state: 'running', tunnelId: 'tunnel_preview', organizationId: 'org_preview', apiKeyConfigured: true, dependencyAvailable: true },
      { id: 'core', label: 'Agent Helm Service', kind: 'toggle', enabled: true, configurable: true, state: 'running' },
    ],
    workspaces: [
      { id: 'workspace-agent-helm', title: 'example-project' },
      { id: 'workspace-forma', title: 'forma' },
    ],
    works: clone(works),
  }

  private readonly details = new Map<string, WorkHistoryDetail>([
    ['work-browser-extension', makeDetail(works[0]!, 'https://chatgpt.com/c/mock-browser-extension', 'Implement Issue #12 Phase 1 using the fixed WXT + React + TypeScript engineering stack.')],
    ['work-tunnel-errors', makeDetail(works[1]!, 'https://chatgpt.com/c/mock-tunnel-errors', 'Propagate existing Tunnel runtime error state to parent UI surfaces.')],
    ['work-forma', makeDetail(works[2]!, 'https://chatgpt.com/c/mock-forma', 'Inspect the current workspace state.')],
  ])

  setConnectionState(state: ControlPlaneSnapshot['connection']['state']): void {
    this.snapshot.connection = { state, ...(state === 'connected' ? { message: 'Mock Agent Helm service' } : { message: `Preview ${state} state` }) }
  }

  async getSnapshot(): Promise<ControlPlaneSnapshot> {
    return clone(this.snapshot)
  }


  async getWorkHistoryPage(cursor?: string) {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0
    const page = this.snapshot.works.slice(offset, offset + 10)
    const nextOffset = offset + page.length
    return { works: clone(page), ...(nextOffset < this.snapshot.works.length ? { nextCursor: String(nextOffset) } : {}) }
  }

  async findWorkByConversation(pageContext: PageContext): Promise<WorkHistorySummary | null> {
    const conversationUrl = normalizeChatGPTConversationUrl(pageContext.conversationUrl ?? pageContext.url ?? '')
    if (!conversationUrl) return null
    for (const [workId, detail] of this.details) {
      if (!detail.chatUrls.includes(conversationUrl)) continue
      const summary = this.snapshot.works.find((work) => work.id === workId)
      return summary ? clone(summary) : null
    }
    return null
  }

  async getWorkDetail(workId: string): Promise<WorkHistoryDetail> {
    const detail = this.details.get(workId)
    if (!detail) throw new Error(`Unknown Work History record: ${workId}`)
    return clone(detail)
  }

  async addWorkspace(): Promise<ControlPlaneSnapshot | null> {
    const picker = (globalThis as typeof globalThis & {
      showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<{ name: string }>
    }).showDirectoryPicker
    if (!picker) throw new Error('Directory picker is unavailable in this preview browser.')

    let handle: { name: string }
    try {
      handle = await picker({ mode: 'read' })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return null
      throw cause
    }

    const title = handle.name.trim()
    if (!title) return null
    const existing = this.snapshot.workspaces.find((workspace) => workspace.title === title)
    if (!existing) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace'
      this.snapshot.workspaces.push({ id: `workspace-preview-${slug}`, title })
    }
    return this.getSnapshot()
  }

  async setCapability(capability: CapabilityKey, enabled: boolean): Promise<ControlPlaneSnapshot> {
    const item = this.snapshot.capabilities[capability]
    if (!item.available) throw new Error(`${capability} is unavailable`)
    item.enabled = enabled
    return this.getSnapshot()
  }

  async setAgentEnabled(agentId: string, enabled: boolean): Promise<ControlPlaneSnapshot> {
    const agent = this.snapshot.agents.find((item) => item.id === agentId)
    if (!agent?.configurable) throw new Error(`Agent control is unavailable: ${agentId}`)
    agent.enabled = enabled
    return this.getSnapshot()
  }

  async configureTunnel(input: TunnelSetupValues): Promise<ControlPlaneSnapshot> {
    const tunnel = this.snapshot.settings.find((item) => item.id === 'tunnel')
    if (!tunnel) throw new Error('Tunnel setting is unavailable')
    tunnel.tunnelId = input.tunnelId.trim()
    tunnel.organizationId = input.organizationId?.trim() || undefined
    tunnel.apiKeyConfigured = Boolean(input.apiKey?.trim()) || tunnel.apiKeyConfigured === true
    tunnel.state = tunnel.apiKeyConfigured && tunnel.tunnelId ? 'running' : 'error'
    return this.getSnapshot()
  }


  async setSetting(settingId: string, enabled: boolean): Promise<ControlPlaneSnapshot> {
    const setting = this.snapshot.settings.find((item) => item.id === settingId)
    if (!setting || setting.kind !== 'toggle' || !setting.configurable) throw new Error(`Setting is unavailable: ${settingId}`)
    setting.enabled = enabled
    return this.getSnapshot()
  }

  async installDependency(dependency: DependencyName): Promise<ControlPlaneSnapshot> {
    this.snapshot.dependencies[dependency].state = 'ready'
    if (dependency === 'tunnelClient') {
      const tunnel = this.snapshot.settings.find((item) => item.id === 'tunnel')
      if (tunnel) {
        tunnel.dependencyAvailable = true
        tunnel.installUrl = undefined
      }
    }
    return this.getSnapshot()
  }

  async bindConversation(workId: string, pageContext: PageContext): Promise<WorkHistoryDetail> {
    const detail = this.details.get(workId)
    if (!detail) throw new Error(`Unknown Work History record: ${workId}`)
    const conversationUrl = normalizeChatGPTConversationUrl(pageContext.conversationUrl ?? pageContext.url ?? '')
    if (!conversationUrl) throw new Error('Current tab is not a ChatGPT conversation')

    for (const [otherWorkId, otherDetail] of this.details) {
      if (otherWorkId !== workId && otherDetail.chatUrls.includes(conversationUrl)) {
        throw new Error(`ChatGPT conversation is already linked to Work History record ${otherWorkId}`)
      }
    }

    if (!detail.chatUrls.includes(conversationUrl)) detail.chatUrls.push(conversationUrl)
    detail.chatCount = Math.max(detail.chatCount, detail.chatUrls.length)
    const summary = this.snapshot.works.find((work) => work.id === workId)
    if (summary) summary.chatCount = detail.chatCount
    return clone(detail)
  }
}
