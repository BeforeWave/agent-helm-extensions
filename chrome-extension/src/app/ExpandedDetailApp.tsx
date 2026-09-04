import { useEffect, useState } from 'react'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { WorkDetail } from '../components/WorkDetail'
import { useCurrentConversationWork, usePageContext } from '../features/useControlPlane'
import { t } from '../locale'
import type { WorkHistoryDetail } from '../models/controlPlane'

export function ExpandedDetailApp({ client, workId }: { client: BrowserControlPlaneClient; workId: string | null }) {
  const pageContextState = usePageContext(client)
  const pageContext = pageContextState.value
  const currentConversation = useCurrentConversationWork(client, pageContext, pageContextState.resolved)
  const [detail, setDetail] = useState<WorkHistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workId) return
    let cancelled = false
    void client.getWorkDetail(workId).then((value) => {
      if (!cancelled) {
        setDetail(value)
        setError(null)
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => { cancelled = true }
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
