import { WorkHistoryRow } from '../__shared/work-history-ui/index'
import { t } from '../locale'
import type { WorkHistorySummary } from '../models/controlPlane'
import { formatTimestamp } from '../services/time'

export function partitionWorkHistoryByCurrentConversation(works: WorkHistorySummary[], currentConversationWork: WorkHistorySummary | null | undefined) {
  if (!currentConversationWork) return { current: null, recent: works }
  const current = works.find((work) => work.id === currentConversationWork.id) ?? currentConversationWork
  return {
    current,
    recent: works.filter((work) => work.id !== currentConversationWork.id),
  }
}

function WorkCard({ work, onSelect, current = false }: { work: WorkHistorySummary; onSelect: (workId: string) => void; current?: boolean }) {
  return <WorkHistoryRow
    item={{ id: work.id, title: work.title, timestamp: work.lastActivityAt, linked: Boolean(work.chatUrls?.length) }}
    current={current}
    linkedLabel={t('extensionConversationLinked')}
    unlinkedLabel={t('extensionConversationUnlinked')}
    formatTimestamp={formatTimestamp}
    onSelect={onSelect}
  />
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
