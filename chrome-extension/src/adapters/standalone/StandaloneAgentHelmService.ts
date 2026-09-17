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
} from '../../models/controlPlane'
import type { TunnelSetupValues } from '../../ui-contract'
import { NativeAgentHelmService } from '../chrome/NativeAgentHelmService'

const SNAPSHOT_POLL_MS = 2_000
const TIMELINE_POLL_MS = 500

export class StandaloneAgentHelmService implements AgentHelmServiceAdapter {
  constructor(private readonly delegate: NativeAgentHelmService) {}

  subscribeSnapshot(listener: (update: ControlPlaneStateUpdate) => void): () => void {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const snapshot = await this.delegate.getSnapshot()
        if (active) listener({ snapshot, error: null })
      } catch (cause) {
        if (active) listener({ snapshot: null, error: cause instanceof Error ? cause.message : String(cause) })
      } finally {
        if (active) timer = setTimeout(() => { void poll() }, SNAPSHOT_POLL_MS)
      }
    }
    timer = setTimeout(() => { void poll() }, SNAPSHOT_POLL_MS)
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }

  subscribeWorkTimeline(workId: string, afterSequence: number, onUpdates: (updates: WorkTimelineItem[]) => void, onError?: (error: Error) => void): () => void {
    let active = true
    let cursor = afterSequence
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const batch = await this.delegate.getWorkTimelineUpdates(workId, cursor)
        cursor = Math.max(cursor, batch.cursorSequence)
        if (active && batch.updates.length) onUpdates(batch.updates)
      } catch (cause) {
        if (active) onError?.(cause instanceof Error ? cause : new Error(String(cause)))
      } finally {
        if (active) timer = setTimeout(() => { void poll() }, TIMELINE_POLL_MS)
      }
    }
    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      void this.delegate.releaseWorkTimeline(workId).catch(() => {})
    }
  }

  getSnapshot(): Promise<ControlPlaneSnapshot> { return this.delegate.getSnapshot() }
  getWorkDetail(workId: string): Promise<WorkHistoryDetail> { return this.delegate.getWorkDetail(workId) }
  getWorkHistoryPage(cursor?: string): Promise<WorkHistoryPage> { return this.delegate.getWorkHistoryPage(cursor) }
  findWorkByConversation(pageContext: PageContext): Promise<WorkHistorySummary | null> { return this.delegate.findWorkByConversation(pageContext) }
  addWorkspace(): Promise<ControlPlaneSnapshot | null> { return this.delegate.addWorkspace() }
  setCapability(capability: CapabilityKey, enabled: boolean): Promise<ControlPlaneSnapshot> { return this.delegate.setCapability(capability, enabled) }
  setAgentEnabled(agentId: string, enabled: boolean): Promise<ControlPlaneSnapshot> { return this.delegate.setAgentEnabled(agentId, enabled) }
  configureTunnel(input: TunnelSetupValues): Promise<ControlPlaneSnapshot> { return this.delegate.configureTunnel(input) }
  setSetting(settingId: string, enabled: boolean): Promise<ControlPlaneSnapshot> { return this.delegate.setSetting(settingId, enabled) }
  installDependency(dependency: DependencyName): Promise<ControlPlaneSnapshot> { return this.delegate.installDependency(dependency) }
  bindConversation(workId: string, pageContext: PageContext): Promise<WorkHistoryDetail> { return this.delegate.bindConversation(workId, pageContext) }
}
