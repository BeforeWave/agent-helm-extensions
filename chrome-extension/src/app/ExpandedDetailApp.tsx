import { useEffect, useState } from 'react'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { WorkDetail } from '../components/WorkDetail'
import { useCurrentConversationWork, usePageContext } from '../features/useControlPlane'
import { t } from '../locale'
import type { WorkHistoryDetail } from '../models/controlPlane'
import { mergeWorkHistoryTimeline } from '../models/workHistory'

export function ExpandedDetailApp({ client, workId }: { client: BrowserControlPlaneClient; workId: string | null }) {
  const pageContextState = usePageContext(client)
  const pageContext = pageContextState.value
  const currentConversation = useCurrentConversationWork(client, pageContext, pageContextState.resolved)
  const [detail, setDetail] = useState<WorkHistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workId) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    void client.getWorkDetail(workId).then((value) => {
      if (cancelled) return
      setDetail(value)
      setError(null)
      const afterSequence = value.timeline.reduce((cursor, item) => Math.max(cursor, item.sequence), 0)
      unsubscribe = client.subscribeWorkTimeline(workId, afterSequence, (updates) => {
        if (cancelled) return
        setDetail((current) => {
          const base = current?.id === workId ? current : value
          return { ...base, timeline: mergeWorkHistoryTimeline(base.timeline, updates), timelineError: undefined }
        })
      }, (cause) => {
        if (!cancelled) setDetail((current) => current?.id === workId ? { ...current, timelineError: cause.message } : current)
      })
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [client, workId])

  if (!workId) return <main className="expanded-shell"><div className="empty-state full-height">{t('extensionNoWorkSelected')}</div></main>
  if (!detail) return <main className="expanded-shell"><div className="empty-state full-height">{error || t('extensionLoadingWorkDetail')}</div></main>
  return (
    <main className="expanded-shell">
      <WorkDetail
        detail={detail}
        pageContext={pageContext}
        client={client}
        currentConversationWork={currentConversation.work}
        currentConversationResolved={currentConversation.resolved}
        onDetailChange={setDetail}
        onConversationBound={currentConversation.refresh}
        onViewConversationWork={(id) => { void client.openExpandedDetail(id) }}
      />
    </main>
  )
}
