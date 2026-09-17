import { useEffect, useMemo, useRef, useState } from 'react'
import { createWorkHistoryListModel, mergeGroupedWorkHistoryTimeline, mergeWorkHistoryConversationDetail, mergeWorkHistoryTimeline } from '../models/workHistory'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { WorkDetail } from '../components/WorkDetail'
import { WorkHistoryList } from '../components/WorkHistoryList'
import { useControlPlaneSnapshot, useCurrentConversationWork, usePageContext } from '../features/useControlPlane'
import { t } from '../locale'
import { workspaceDisplayTitle, type WorkHistoryDetail, type WorkHistorySummary } from '../models/controlPlane'

import { CoreSettingControl, ExtensionSettingsControls } from '../components/ExtensionSettingsControls'
import { ChevronIcon } from '../components/Icons'
import { LoadingSurface } from '../components/LoadingSurface'

function WorkspaceSelector({
  workspaces,
  value,
  disabled,
  onChange,
  onAdd,
}: {
  workspaces: Array<{ id: string; title: string }>
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onAdd: () => Promise<void>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)

  const addWorkspace = async () => {
    if (adding || disabled) return
    setAdding(true)
    try {
      await onAdd()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="workspace-filter">
      <label htmlFor="agent-helm-workspace-filter">{t('sessionWorkspace')}</label>
      <div className="workspace-control-group">
        <div className="workspace-select">
          <select
            id="agent-helm-workspace-filter"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="all">{t('extensionAllWorkspaces')}</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.title}</option>
            ))}
          </select>
          <span className="workspace-select__icon" aria-hidden="true"><ChevronIcon direction="down" /></span>
        </div>
        <button
          type="button"
          className="workspace-add-button"
          aria-label="Add Workspace"
          title="Add Workspace"
          disabled={disabled || adding}
          data-busy={adding || undefined}
          onClick={() => { void addWorkspace() }}
        >
          <svg className="workspace-add-button__icon" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4.25v11.5M4.25 10h11.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function SidePanelApp({ client }: { client: BrowserControlPlaneClient }) {
  const { snapshot, setSnapshot, error, setError, loading } = useControlPlaneSnapshot(client)
  const pageContextState = usePageContext(client)
  const pageContext = pageContextState.value
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [detail, setDetail] = useState<WorkHistoryDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingControl, setPendingControl] = useState<string | null>(null)
  const [loadingMoreWork, setLoadingMoreWork] = useState(false)
  const [workHistoryState, setWorkHistoryState] = useState<{
    works: WorkHistorySummary[]
    nextCursor: string | undefined
    loading: boolean
    loaded: boolean
    error: string | null
  }>({ works: [], nextCursor: undefined, loading: false, loaded: false, error: null })
  const [agentsInitiallyExpanded, setAgentsInitiallyExpanded] = useState(false)
  const [tunnelInitiallyExpanded, setTunnelInitiallyExpanded] = useState(false)
  const coreIssue = snapshot?.settings.find((setting) => setting.id === 'core')?.message
  const visibleIssue = error ?? coreIssue
  const listScrollRef = useRef<HTMLDivElement>(null)
  const rememberedScrollTop = useRef(0)

  const coreRunning = snapshot?.settings.find((setting) => setting.id === 'core')?.state === 'running'
  const currentConversationUrl = pageContext?.conversationUrl ?? null
  const loadedCurrentConversationWork = currentConversationUrl
    ? workHistoryState.works.find((work) => work.chatUrls?.includes(currentConversationUrl)) ?? null
    : null
  const currentConversationLookup = useCurrentConversationWork(
    client,
    pageContext,
    pageContextState.resolved,
    Boolean(coreRunning && workHistoryState.loaded && currentConversationUrl && !loadedCurrentConversationWork),
  )
  const currentConversation = {
    work: loadedCurrentConversationWork ?? currentConversationLookup.work,
    resolved: !currentConversationUrl
      ? pageContextState.resolved
      : !coreRunning
        ? true
        : loadedCurrentConversationWork
          ? true
          : workHistoryState.loaded && currentConversationLookup.resolved,
    refresh: currentConversationLookup.refresh,
  }
  const workHistory = useMemo(() => createWorkHistoryListModel({
    items: workHistoryState.works,
    workspaceId: workspaceFilter,
    selectedId: selectedWorkId,
    workspaces: snapshot?.workspaces.map((workspace) => ({ id: workspace.id, title: workspaceDisplayTitle(workspace) })) ?? [],
    autoSelectFirst: false,
  }), [snapshot?.workspaces, workHistoryState.works, workspaceFilter, selectedWorkId])
  const visibleWorks = workHistory.items
  const selectedWork = selectedWorkId ? workHistoryState.works.find((work) => work.id === selectedWorkId) : undefined
  const selectedWorkMembersKey = selectedWork?.workIds?.join('\u0000') ?? selectedWorkId ?? ''
  const workHistoryLoading = (loading && !snapshot)
    || (coreRunning && !workHistoryState.loaded)
    || (coreRunning && workHistoryState.works.length === 0 && !currentConversation.resolved)

  useEffect(() => {
    if (!coreRunning) return
    let cancelled = false
    setWorkHistoryState((current) => ({ ...current, loading: true, error: null }))
    void client.getWorkHistoryPage().then((page) => {
      if (cancelled) return
      setWorkHistoryState({
        works: page.works,
        nextCursor: page.nextCursor,
        loading: false,
        loaded: true,
        error: null,
      })
    }).catch((cause) => {
      if (cancelled) return
      setWorkHistoryState((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: cause instanceof Error ? cause.message : String(cause),
      }))
    })
    return () => { cancelled = true }
  }, [client, coreRunning])

  useEffect(() => {
    let cancelled = false
    void client.consumePendingSettingsSection().then((section) => {
      if (!cancelled && section === 'agents') setAgentsInitiallyExpanded(true)
      if (!cancelled && section === 'tunnel') setTunnelInitiallyExpanded(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    let cancelled = false
    void client.consumePendingWorkId().then((workId) => {
      if (!cancelled && workId) setSelectedWorkId(workId)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    if (!selectedWorkId) {
      setDetail(null)
      setDetailError(null)
      return
    }
    let cancelled = false
    const unsubscribes: Array<() => void> = []
    const workIds = selectedWork?.workIds?.length ? selectedWork.workIds : [selectedWorkId]
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    void Promise.all(workIds.map(async (workId) => await client.getWorkDetail(workId))).then((details) => {
      if (cancelled) return
      const grouped = details.length > 1 && Boolean(selectedWork)
      const value = mergeWorkHistoryConversationDetail(selectedWork ?? details[0]!, details)
      setDetail(value)
      setDetailError(null)
      for (const member of details) {
        const afterSequence = member.timeline.reduce((cursor, item) => Math.max(cursor, item.sequence), 0)
        unsubscribes.push(client.subscribeWorkTimeline(member.id, afterSequence, (updates) => {
          if (cancelled) return
          setDetail((current) => {
            if (current?.id !== selectedWorkId) return current
            if (!grouped) return { ...current, timeline: mergeWorkHistoryTimeline(current.timeline, updates), timelineError: undefined }
            return { ...current, timeline: mergeGroupedWorkHistoryTimeline(current.timeline, member.id, updates), timelineError: undefined }
          })
        }, (cause) => {
          if (cancelled) return
          setDetail((current) => current?.id === selectedWorkId ? { ...current, timelineError: cause.message } : current)
        }))
      }
    }).catch((cause) => {
      if (!cancelled) setDetailError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (!cancelled) setDetailLoading(false)
    })
    return () => {
      cancelled = true
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [client, selectedWorkId, selectedWorkMembersKey])

  const selectWork = (workId: string) => {
    rememberedScrollTop.current = listScrollRef.current?.scrollTop ?? 0
    setSelectedWorkId(workId)
  }

  const backToList = () => {
    setSelectedWorkId(null)
    requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = rememberedScrollTop.current
    })
  }

  const loadMoreWorkHistory = async () => {
    const cursor = workHistoryState.nextCursor
    if (!cursor || loadingMoreWork) return
    setLoadingMoreWork(true)
    try {
      const page = await client.getWorkHistoryPage(cursor)
      setWorkHistoryState((current) => {
        const byId = new Map(current.works.map((work) => [work.id, work]))
        for (const work of page.works) byId.set(work.id, work)
        return {
          ...current,
          works: [...byId.values()],
          nextCursor: page.nextCursor,
          error: null,
        }
      })
    } catch (cause) {
      setWorkHistoryState((current) => ({ ...current, error: cause instanceof Error ? cause.message : String(cause) }))
    } finally {
      setLoadingMoreWork(false)
    }
  }

  const mutateControl = async (key: string, operation: () => ReturnType<BrowserControlPlaneClient['getSnapshot']>) => {
    setPendingControl(key)
    try {
      setSnapshot(await operation())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPendingControl(null)
    }
  }

  const configureTunnel = async (input: Parameters<BrowserControlPlaneClient['configureTunnel']>[0]) => {
    setPendingControl('tunnel:setup')
    try {
      const next = await client.configureTunnel(input)
      setSnapshot(next)
      setError(null)
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally {
      setPendingControl(null)
    }
  }



  if (selectedWorkId) {
    if (detailLoading && !detail) {
      return <main className="sidepanel-shell sidepanel-shell--detail"><div className="empty-state full-height">{t('extensionLoadingWorkDetail')}</div></main>
    }
    if (!detail) {
      return <main className="sidepanel-shell sidepanel-shell--detail"><div className="empty-state full-height">{detailError || t('extensionWorkDetailUnavailable')}</div></main>
    }
    return (
      <main className="sidepanel-shell sidepanel-shell--detail">
        <WorkDetail
          detail={detail}
          pageContext={pageContext}
          client={client}
          onBack={backToList}
          currentConversationWork={currentConversation.work}
          currentConversationResolved={currentConversation.resolved}
          onExpand={() => { void client.openExpandedDetail(detail.id) }}
          onDetailChange={setDetail}
          onConversationBound={() => {
            currentConversation.refresh()
          }}
          onViewConversationWork={selectWork}
        />
      </main>
    )
  }

  return (
    <main className="sidepanel-shell">
      <header className="brand-header">
        <div className="brand-copy">
          <div className="brand-title">Agent Helm</div>
          <div className="brand-subtitle">{t('extensionTagline')}</div>
        </div>
        <CoreSettingControl
          snapshot={snapshot}
          pending={pendingControl}
          mode="header"
          onChange={(enabled) => { void mutateControl('setting:core', () => client.setSetting('core', enabled)) }}
        />
      </header>

      {visibleIssue ? <div className="error-banner sidepanel-error">{visibleIssue}</div> : null}

      <section className="sidepanel-controls" aria-label={t('status')}>
        <LoadingSurface loading={loading && !snapshot} label={t('loading')}>
          <ExtensionSettingsControls
            snapshot={snapshot}
            loading={loading && !snapshot}
            pending={pendingControl}
            capabilitiesInitiallyExpanded={false}
            agentsInitiallyExpanded={agentsInitiallyExpanded}
            tunnelInitiallyExpanded={tunnelInitiallyExpanded}
            includeCoreRow={false}
            showInstallGuidance
            dependencySetupMode="expandable"
            sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents']}
            onCapabilityChange={(capability, enabled) => {
              void mutateControl(`capability:${capability}`, () => client.setCapability(capability, enabled))
            }}
            onAgentChange={(agentId, enabled) => {
              void mutateControl(`agent:${agentId}`, () => client.setAgentEnabled(agentId, enabled))
            }}
            onTunnelSetup={configureTunnel}
            onSettingChange={(settingId, enabled) => {
              void mutateControl(`setting:${settingId}`, () => client.setSetting(settingId, enabled))
            }}
            onDependencyInstall={(dependency) => {
              void mutateControl('dependency:' + dependency, () => client.installDependency(dependency))
            }}
            onOpenUrl={(url) => {
              void client.openExternalUrl(url).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
            }}
            onInstallerDownload={(url, filename) => {
              void client.downloadFile(url, filename).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
            }}
          />
        </LoadingSurface>

        <WorkspaceSelector
          workspaces={workHistory.workspace.options.map((workspace) => ({ id: workspace.id, title: workspace.label }))}
          value={workspaceFilter}
          disabled={!snapshot}
          onChange={setWorkspaceFilter}
          onAdd={async () => {
            try {
              const previousIds = new Set(snapshot?.workspaces.map((workspace) => workspace.id) ?? [])
              const next = await client.addWorkspace()
              if (!next) return
              setSnapshot(next)
              setError(null)
              const added = next.workspaces.find((workspace) => !previousIds.has(workspace.id))
              if (added) setWorkspaceFilter(added.id)
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : String(cause))
            }
          }}
        />
      </section>

      <div className="sidepanel-section-heading">{t('extensionWorkHistorySection')}</div>
      <section className="work-history-region" ref={listScrollRef} aria-busy={workHistoryLoading}>
        {workHistoryLoading
          ? <div className="empty-state">{t('extensionLoadingWorkHistory')}</div>
          : workHistoryState.error && !visibleWorks.length && !currentConversation.work
            ? <div className="empty-state">{workHistoryState.error}</div>
            : visibleWorks.length || currentConversation.work
              ? <WorkHistoryList
                  works={visibleWorks}
                  currentConversationWork={currentConversation.work}
                  onSelect={selectWork}
                  hasMore={Boolean(workHistoryState.nextCursor)}
                  loadingMore={loadingMoreWork}
                  onLoadMore={() => { void loadMoreWorkHistory() }}
                />
              : <div className="empty-state">{t('extensionNoWorkHistory')}</div>}
      </section>
    </main>
  )
}
