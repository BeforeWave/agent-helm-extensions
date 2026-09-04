import { useEffect, useState } from 'react'
import type { WorkHistoryPresentationDetail, WorkHistoryPresentationLabel, WorkHistoryPresentationTitle } from '@beforewave/agent-helm-ui-contract'
import { filterWorkHistoryTimeline, type WorkHistoryActivityFilter } from '../models/workHistory'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { t } from '../locale'
import type { PageContext, WorkConversationIntent, WorkHistoryDetail as WorkHistoryDetailModel, WorkHistorySummary, WorkTimelineItem } from '../models/controlPlane'
import { isConversationBound } from '../services/binding'
import { formatTimestamp } from '../services/time'

function BackIcon() {
  return <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 4.5 6 10l5.5 5.5M6.5 10H16" /></svg>
}

function ExpandIcon() {
  return <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 3.5h-4v4M12.5 3.5h4v4M7.5 16.5h-4v-4M12.5 16.5h4v-4" /></svg>
}

function ExternalIcon() {
  return <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M11 4h5v5M16 4l-7 7M8 6H5.5A1.5 1.5 0 0 0 4 7.5v7A1.5 1.5 0 0 0 5.5 16h7a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>
}

function presentationLabel(label: WorkHistoryPresentationLabel): string {
  if (label === 'activity') return t('sessionAction')
  if (label === 'delegation.created') return t('sessionDelegationCreated')
  if (label === 'delegation.attached') return t('sessionDelegationAttached')
  if (label === 'delegation.prompted') return t('sessionDelegationPrompted')
  if (label === 'delegation.resumed') return t('sessionDelegationResumed')
  if (label === 'delegation.status') return t('sessionDelegationStatus')
  if (label === 'action.read') return t('sessionActionRead')
  if (label === 'action.search') return t('sessionActionSearch')
  if (label === 'action.inspect') return t('sessionActionInspect')
  if (label === 'action.diagnostic') return t('sessionActionDiagnostic')
  if (label === 'action.verify') return t('sessionActionVerify')
  if (label === 'action.command') return t('sessionActionCommand')
  return t('sessionActionEdit')
}

function presentationTitle(title: WorkHistoryPresentationTitle): string {
  return title.kind === 'text' ? title.text : presentationLabel(title.label)
}

function statusLabel(status: string): string {
  if (status === 'success') return t('sessionStatusSuccess')
  if (status === 'error') return t('sessionStatusError')
  if (status === 'idle') return t('sessionStatusIdle')
  if (status === 'running') return t('sessionStatusRunningAgent')
  if (status === 'waiting') return t('sessionStatusWaiting')
  if (status === 'failed') return t('sessionStatusFailedAgent')
  if (status === 'cancelled') return t('sessionStatusCancelled')
  return t('sessionStatusUnknown')
}

function presentationDetail(detail: WorkHistoryPresentationDetail): string {
  if (detail.kind === 'duration') return `${detail.durationMs} ms`
  if (detail.kind === 'subagent-session') return `${t('sessionSubagentId')}: ${detail.id}`
  if (detail.kind === 'status') return statusLabel(detail.text)
  return detail.text
}

type ActivityFilter = WorkHistoryActivityFilter

export function filterTimelineItems(timeline: WorkTimelineItem[], filter: ActivityFilter): WorkTimelineItem[] {
  return filterWorkHistoryTimeline(timeline, filter)
}

function ContextCard({ intent, role, boundAt }: { intent: WorkConversationIntent; role: string; boundAt?: string }) {
  return (
    <article className="context-card">
      <div className="context-card__head">
        <span className="context-card__role">{role}</span>
        <span className="context-card__message">{intent.message}</span>
      </div>
      {boundAt ? <div className="context-card__meta"><span>{t('extensionBound')} · {formatTimestamp(boundAt)}</span></div> : null}
      <details className="context-card__task">
        <summary>{t('sessionTaskContext')}</summary>
        <div>{intent.task}</div>
      </details>
    </article>
  )
}

interface WorkDetailProps {
  detail: WorkHistoryDetailModel
  pageContext: PageContext | null
  client: BrowserControlPlaneClient
  currentConversationWork?: WorkHistorySummary | null
  currentConversationResolved?: boolean
  onBack?: () => void
  onExpand?: () => void
  onDetailChange?: (detail: WorkHistoryDetailModel) => void
  onConversationBound?: () => void
  onViewConversationWork?: (workId: string) => void
}

export function WorkDetail({
  detail,
  pageContext,
  client,
  currentConversationWork = null,
  currentConversationResolved = true,
  onBack,
  onExpand,
  onDetailChange,
  onConversationBound,
  onViewConversationWork,
}: WorkDetailProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [binding, setBinding] = useState(false)
  const [bindingError, setBindingError] = useState<string | null>(null)
  const currentConversation = pageContext?.conversationUrl ?? null
  useEffect(() => { setBindingError(null) }, [currentConversation])
  const directlyBound = isConversationBound(detail, pageContext)
  const linkedHere = Boolean(currentConversation) && (directlyBound || currentConversationWork?.id === detail.id)
  const linkedElsewhere = Boolean(currentConversation && currentConversationWork && currentConversationWork.id !== detail.id && !directlyBound)
  const checkingConversation = Boolean(currentConversation) && !linkedHere && !currentConversationResolved
  const canBind = Boolean(currentConversation) && currentConversationResolved && !linkedHere && !linkedElsewhere && !binding

  const bindCurrent = async () => {
    if (!pageContext || !canBind) return
    setBinding(true)
    setBindingError(null)
    try {
      const next = await client.bindConversation(detail.id, pageContext)
      onDetailChange?.(next)
      onConversationBound?.()
    } catch (cause) {
      setBindingError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBinding(false)
    }
  }

  const openBoundConversation = linkedHere && currentConversation ? currentConversation : detail.chatUrls.at(-1)
  const visibleTimeline = filterTimelineItems(detail.timeline, activityFilter)
  const linkedConversationCount = detail.chatUrls.length

  const conversationPrimary = currentConversation
    ? t('extensionCurrentConversationDetected')
    : linkedConversationCount
      ? t('extensionLinkedConversationsCount', { count: linkedConversationCount })
      : t('extensionNoLinkedConversation')
  const conversationSecondary = bindingError
    ? bindingError
    : currentConversation
      ? checkingConversation
        ? t('extensionConversationChecking')
        : linkedHere
          ? t('extensionConversationLinked')
          : linkedElsewhere
            ? t('extensionConversationLinkedElsewhere')
            : t('extensionConversationNotLinked')
      : undefined

  return (
    <div className="work-detail">
      <header className="detail-toolbar">
        <div className="detail-toolbar__left">
          {onBack ? <button type="button" className="icon-button detail-back" onClick={onBack}><BackIcon /><span>{t('extensionWorkDetail')}</span></button> : <strong>{t('extensionWorkDetail')}</strong>}
        </div>
        {onExpand ? <button type="button" className="secondary-button detail-expand" onClick={onExpand}><ExpandIcon /><span>{t('extensionExpand')}</span></button> : null}
      </header>

      <section className="detail-summary">
        <h1>{detail.title}</h1>
        <div className="detail-times">{t('sessionCreated')} · {formatTimestamp(detail.createdAt)} · {t('sessionUpdated')} · {formatTimestamp(detail.lastActivityAt)}</div>
        <dl className="detail-facts">
          <div><dt>{t('sessionWorkspace')}</dt><dd>{detail.workspaceTitle || t('sessionUnassignedWorkspace')}</dd></div>
          <div>
            <dt>{t('extensionAgentRuntime')}</dt>
            <dd className="detail-fact-with-action">
              <span>{[detail.agentLabel, detail.runtimeLabel].filter(Boolean).join(' · ') || t('stateUnavailable')}</span>
              {detail.localDeepLink ? <button type="button" className="secondary-button compact-action button-with-icon" onClick={() => void client.openLocalDeepLink(detail.localDeepLink!)}>{t('extensionOpenLocalApp')} <ExternalIcon /></button> : null}
            </dd>
          </div>
          <div><dt>{t('extensionActivity')}</dt><dd>{t('extensionActivitiesCount', { count: detail.eventCount })} · {t('extensionConversationsCount', { count: detail.chatCount })}</dd></div>
          <div className="detail-chatgpt-fact">
            <dt>ChatGPT</dt>
            <dd className="detail-chatgpt-value">
              <span className="detail-chatgpt-copy">
                <span className="detail-chatgpt-primary">{conversationPrimary}</span>
                {conversationSecondary ? <span className={bindingError ? 'detail-chatgpt-secondary detail-chatgpt-secondary--error' : 'detail-chatgpt-secondary'}>{conversationSecondary}</span> : null}
              </span>
              <span className="detail-chatgpt-actions">
                {canBind ? <button type="button" className="primary-button compact-action" onClick={() => void bindCurrent()}>{t('extensionBind')}</button> : null}
                {binding ? <button type="button" className="primary-button compact-action" disabled>{t('extensionBinding')}</button> : null}
                {linkedHere && openBoundConversation ? <button type="button" className="secondary-button compact-action button-with-icon" onClick={() => void client.openExternalUrl(openBoundConversation)}>{t('extensionOpen')} <ExternalIcon /></button> : null}
                {linkedElsewhere && currentConversationWork && onViewConversationWork ? <button type="button" className="secondary-button compact-action" onClick={() => onViewConversationWork(currentConversationWork.id)}>{t('extensionViewWork')}</button> : null}
                {!currentConversation && openBoundConversation ? <button type="button" className="secondary-button compact-action button-with-icon" onClick={() => void client.openExternalUrl(openBoundConversation)}>{t('extensionOpen')} <ExternalIcon /></button> : null}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>{t('extensionOriginContext')}</h2>
        {detail.boundIntents.map((entry, index) => <ContextCard key={`${entry.boundAt}:${index}`} intent={entry.intent} boundAt={entry.boundAt} role={t('extensionBoundNumber', { index: detail.boundIntents.length - index })} />)}
        {detail.originIntent ? <ContextCard intent={detail.originIntent} role={t('sessionOriginChat')} /> : detail.boundIntents.length ? null : <div className="empty-state">{t('extensionNoWorkContext')}</div>}
      </section>

      <section className="timeline-section">
        <nav className="timeline-filters" aria-label={t('extensionActivityType')}>
          <button type="button" className="timeline-filter" data-active={activityFilter === 'all'} onClick={() => setActivityFilter('all')}>{t('sessionAll')}</button>
          <button type="button" className="timeline-filter" data-active={activityFilter === 'chatgpt'} onClick={() => setActivityFilter('chatgpt')}>{t('sessionChatGPT')}</button>
          <button type="button" className="timeline-filter" data-active={activityFilter === 'subagent'} onClick={() => setActivityFilter('subagent')}>{t('sessionSubagent')}</button>
        </nav>
        <div className="timeline">
          {visibleTimeline.length ? visibleTimeline.map((item) => (
            <article className="timeline-item" key={item.id}>
              <time>{formatTimestamp(item.timestamp)}</time>
              <div><span className="actor-badge">{item.actorName || (item.actor === 'subagent' ? t('sessionSubagent') : t('sessionChatGPT'))}</span></div>
              <div className="timeline-item__content">
                <strong>{presentationTitle(item.presentation.title)}</strong>
                {item.presentation.primary ? <div>{item.presentation.primary}</div> : null}
                <div className="timeline-item__secondary">
                  {item.presentation.details.map((detail, detailIndex) => <span key={detailIndex}>{presentationDetail(detail)}</span>)}
                </div>
              </div>
            </article>
          )) : <div className="empty-state">{t('extensionNoActivity')}</div>}
        </div>
      </section>
    </div>
  )
}
