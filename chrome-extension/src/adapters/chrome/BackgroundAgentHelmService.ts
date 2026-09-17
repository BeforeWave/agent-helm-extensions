import type { TunnelSetupValues } from '../../ui-contract'
import type { AgentHelmServiceAdapter, ControlPlaneStateUpdate } from '../../models/adapters'
import type {
  CapabilityKey,
  ControlPlaneSnapshot,
  DependencyName,
  PageContext,
  WorkHistoryDetail,
  WorkHistoryPage,
  WorkHistorySummary,
  WorkTimelineItem,
  WorkTimelineUpdateBatch,
} from '../../models/controlPlane'

export const CONTROL_PLANE_REQUEST_MESSAGE = 'agent-helm:control-plane-request'
export const CONTROL_PLANE_SNAPSHOT_MESSAGE = 'agent-helm:control-plane-snapshot'
export const OPEN_SIDE_PANEL_MESSAGE = 'agent-helm:open-side-panel'
export const CONTROL_PLANE_TIMELINE_PORT = 'agent-helm:timeline'

export interface ControlPlaneRequestMessage {
  type: typeof CONTROL_PLANE_REQUEST_MESSAGE
  method: string
  args: unknown[]
}

export interface ControlPlaneSnapshotMessage extends ControlPlaneStateUpdate {
  type: typeof CONTROL_PLANE_SNAPSHOT_MESSAGE
}

interface ControlPlaneResponse {
  ok: boolean
  result?: unknown
  error?: string
}

export class BackgroundAgentHelmService implements AgentHelmServiceAdapter {
  private async request<T>(method: string, args: unknown[] = []): Promise<T> {
    const response = await chrome.runtime.sendMessage({
      type: CONTROL_PLANE_REQUEST_MESSAGE,
      method,
      args,
    } satisfies ControlPlaneRequestMessage) as ControlPlaneResponse | undefined
    if (!response?.ok) throw new Error(response?.error || `Background control-plane request failed: ${method}`)
    return response.result as T
  }

  getSnapshot() { return this.request<ControlPlaneSnapshot>('getSnapshot') }
  getWorkDetail(workId: string) { return this.request<WorkHistoryDetail>('getWorkDetail', [workId]) }
  getWorkTimelineUpdates(workId: string, afterSequence: number) { return this.request<WorkTimelineUpdateBatch>('getWorkTimelineUpdates', [workId, afterSequence]) }
  releaseWorkTimeline(workId: string) { return this.request<void>('releaseWorkTimeline', [workId]) }
  getWorkHistoryPage(cursor?: string) { return this.request<WorkHistoryPage>('getWorkHistoryPage', cursor === undefined ? [] : [cursor]) }
  findWorkByConversation(pageContext: PageContext) { return this.request<WorkHistorySummary | null>('findWorkByConversation', [pageContext]) }
  addWorkspace() { return this.request<ControlPlaneSnapshot | null>('addWorkspace') }
  setCapability(capability: CapabilityKey, enabled: boolean) { return this.request<ControlPlaneSnapshot>('setCapability', [capability, enabled]) }
  setAgentEnabled(agentId: string, enabled: boolean) { return this.request<ControlPlaneSnapshot>('setAgentEnabled', [agentId, enabled]) }
  configureTunnel(input: TunnelSetupValues) { return this.request<ControlPlaneSnapshot>('configureTunnel', [input]) }
  setSetting(settingId: string, enabled: boolean) { return this.request<ControlPlaneSnapshot>('setSetting', [settingId, enabled]) }
  installDependency(dependency: DependencyName) { return this.request<ControlPlaneSnapshot>('installDependency', [dependency]) }
  bindConversation(workId: string, pageContext: PageContext) { return this.request<WorkHistoryDetail>('bindConversation', [workId, pageContext]) }

  subscribeSnapshot(listener: (update: ControlPlaneStateUpdate) => void): () => void {
    const onMessage = (message: unknown) => {
      if (
        typeof message !== 'object'
        || message === null
        || !('type' in message)
        || message.type !== CONTROL_PLANE_SNAPSHOT_MESSAGE
      ) return
      const update = message as ControlPlaneSnapshotMessage
      listener({ snapshot: update.snapshot, error: update.error })
    }
    const runtimeMessages = chrome.runtime.onMessage
    runtimeMessages.addListener(onMessage)
    return () => runtimeMessages.removeListener(onMessage)
  }
  subscribeWorkTimeline(workId: string, afterSequence: number, onUpdates: (updates: WorkTimelineItem[]) => void, onError?: (error: Error) => void): () => void {
    if (!chrome.runtime?.connect) throw new Error('Chrome runtime port API is unavailable')
    const port = chrome.runtime.connect({ name: CONTROL_PLANE_TIMELINE_PORT })
    let active = true
    const handleMessage = (message: unknown) => {
      if (!active || !message || typeof message !== 'object' || Array.isArray(message)) return
      const value = message as { type?: unknown; updates?: unknown; error?: unknown }
      if (value.type === 'timeline' && Array.isArray(value.updates)) onUpdates(value.updates as WorkTimelineItem[])
      else if (value.type === 'timeline-error' && typeof value.error === 'string') onError?.(new Error(value.error))
    }
    const handleDisconnect = () => {
      if (!active) return
      active = false
      const message = chrome.runtime.lastError?.message
      if (message) onError?.(new Error(message))
    }
    port.onMessage.addListener(handleMessage)
    port.onDisconnect.addListener(handleDisconnect)
    port.postMessage({ type: 'subscribe', workId, afterSequence })
    return () => {
      if (!active) return
      active = false
      try { port.disconnect() } catch {}
    }
  }

}
