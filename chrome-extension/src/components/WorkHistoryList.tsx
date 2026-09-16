import { t } from '../locale'
import type { WorkHistorySummary } from '../models/controlPlane'
import { formatTimestamp } from '../services/time'

function sharesConversation(left: WorkHistorySummary, right: WorkHistorySummary): boolean {
  const leftIds = new Set(left.workIds?.length ? left.workIds : [left.id])
  const rightIds = right.workIds?.length ? right.workIds : [right.id]
  if (rightIds.some((id) => leftIds.has(id))) return true
  const leftUrls = new Set(left.chatUrls ?? [])
  return (right.chatUrls ?? []).some((url) => leftUrls.has(url))
}

export function partitionWorkHistoryByCurrentConversation(works: WorkHistorySummary[], currentConversationWork: WorkHistorySummary | null | undefined) {
  if (!currentConversationWork) return { current: null, recent: works }
  const current = works.find((work) => sharesConversation(work, currentConversationWork)) ?? currentConversationWork
  return {
    current,
    recent: works.filter((work) => !sharesConversation(work, currentConversationWork)),
  }
}

function WorkCard({ work, onSelect, current = false }: { work: WorkHistorySummary; onSelect: (workId: string) => void; current?: boolean }) {
  return (
    <button type="button" className={current ? 'work-card work-card--current' : 'work-card'} onClick={() => onSelect(work.id)}>
      <div className="work-card__title">{work.title}</div>
      <div className="work-card__time">{t('sessionRecentActivity')} · {formatTimestamp(work.lastActivityAt)}</div>
      <div className="work-card__meta">
        <span>{t('extensionConversationsCount', { count: work.chatCount })}</span>
        {current ? <span className="work-card__current-badge">{t('extensionConversationLinked')}</span> : null}
      </div>
    </button>
  )
}

export function WorkHistoryList({
  works,
  currentConversationWork,
  onSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  works: WorkHistorySummary[]
  currentConversationWork?: WorkHistorySummary | null
  onSelect: (workId: string) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  const partitioned = partitionWorkHistoryByCurrentConversation(works, currentConversationWork)
  if (!partitioned.current && !partitioned.recent.length) return <div className="empty-state">{t('extensionNoWorkHistory')}</div>

  return (
    <div className="work-list">
      {partitioned.current ? (
        <section className="work-list__section work-list__section--current">
          <div className="work-list__section-label">{t('extensionCurrentConversationSection')}</div>
          <WorkCard work={partitioned.current} onSelect={onSelect} current />
        </section>
      ) : null}
      {partitioned.recent.length ? (
        <section className="work-list__section">
          <div className="work-list__section-label">{t('extensionRecentWork')}</div>
          {partitioned.recent.map((work) => <WorkCard key={work.id} work={work} onSelect={onSelect} />)}
        </section>
      ) : null}
      {hasMore && onLoadMore ? <button type="button" className="work-history-load-more" disabled={loadingMore} onClick={onLoadMore}>{t('sessionLoadMore')}</button> : null}
    </div>
  )
}
