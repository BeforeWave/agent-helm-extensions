import { useEffect, useMemo, useRef, useState } from 'react'
import { createWorkHistoryListModel } from '../models/workHistory'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { WorkDetail } from '../components/WorkDetail'
import { WorkHistoryList } from '../components/WorkHistoryList'
import { useControlPlaneSnapshot, useCurrentConversationWork, usePageContext } from '../features/useControlPlane'
import { t } from '../locale'
import { workspaceDisplayTitle, type WorkHistoryDetail } from '../models/controlPlane'

import { CoreSettingControl, ExtensionSettingsControls } from '../components/ExtensionSettingsControls'
import { ChevronIcon } from '../components/Icons'

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
  const pageContext = usePageContext(client)
  const currentConversation = useCurrentConversationWork(client, pageContext)
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [detail, setDetail] = useState<WorkHistoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingControl, setPendingControl] = useState<string | null>(null)
  const [loadingMoreWork, setLoadingMoreWork] = useState(false)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const rememberedScrollTop = useRef(0)

  const workHistory = useMemo(() => createWorkHistoryListModel({
    items: snapshot?.works ?? [],
    workspaceId: workspaceFilter,
    selectedId: selectedWorkId,
    workspaces: snapshot?.workspaces.map((workspace) => ({ id: workspace.id, title: workspaceDisplayTitle(workspace) })) ?? [],
    autoSelectFirst: false,
  }), [snapshot, workspaceFilter, selectedWorkId])
  const visibleWorks = workHistory.items

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
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void client.getWorkDetail(selectedWorkId).then((value) => {
      if (!cancelled) {
        setDetail(value)
        setError(null)
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (!cancelled) setDetailLoading(false)
    })
    return () => { cancelled = true }
  }, [client, selectedWorkId, setError])

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
    const cursor = snapshot?.worksNextCursor
    if (!snapshot || !cursor || loadingMoreWork) return
    setLoadingMoreWork(true)
    try {
      const page = await client.getWorkHistoryPage(cursor)
      setSnapshot((current) => {
        if (!current) return current
        const byId = new Map(current.works.map((work) => [work.id, work]))
        for (const work of page.works) byId.set(work.id, work)
        return {
          ...current,
          works: [...byId.values()],
          ...(page.nextCursor ? { worksNextCursor: page.nextCursor } : { worksNextCursor: undefined }),
        }
      })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingMoreWork(false)
    }
  }

  const mutateControl = async (key: string, operation: () => ReturnType<BrowserControlPlaneClient['getSnapshot']>) => {
    setPendingControl(key)
    try {
      setSnapshot(await operation())
      setError(null)
      void chrome.runtime.sendMessage({ type: 'agent-helm:refresh-action-status' }).catch(() => {})
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
      void chrome.runtime.sendMessage({ type: 'agent-helm:refresh-action-status' }).catch(() => {})
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
      return <main className="sidepanel-shell sidepanel-shell--detail"><div className="empty-state full-height">{t('extensionWorkDetailUnavailable')}</div></main>
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
            void client.getSnapshot().then(setSnapshot).catch(() => {})
          }}
          onViewConversationWork={selectWork}
        />
      </main>
    )
  }

  return (
    <main className="sidepanel-shell">
      <header className="brand-header">
        <div>
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

      {error ? <div className="error-banner sidepanel-error">{error}</div> : null}

      <section className="sidepanel-controls" aria-label={t('status')}>
        {loading && !snapshot ? (
          <div className="unavailable-state">{t('loading')}</div>
        ) : (
          <ExtensionSettingsControls
            snapshot={snapshot}
            pending={pendingControl}
            capabilitiesInitiallyExpanded={false}
            includeCoreRow={false}
            showInstallGuidance
            sectionOrder={['capabilities', 'agents', 'local-agent-lsp', 'tunnel']}
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
        )}

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

      <div className="history-divider" />

      <section className="work-history-region" ref={listScrollRef}>
        {loading && !snapshot
          ? <div className="empty-state">{t('extensionLoadingWorkHistory')}</div>
          : visibleWorks.length || currentConversation.work
            ? <WorkHistoryList
                works={visibleWorks}
                currentConversationWork={currentConversation.work}
                onSelect={selectWork}
                hasMore={Boolean(snapshot?.worksNextCursor)}
                loadingMore={loadingMoreWork}
                onLoadMore={() => { void loadMoreWorkHistory() }}
              />
            : <div className="empty-state">{t('extensionNoWorkHistory')}</div>}
      </section>
    </main>
  )
}
