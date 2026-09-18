import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterTimelineItems, WorkDetail } from '../src/components/WorkDetail'
import { partitionWorkHistoryByCurrentConversation, WorkHistoryList } from '../src/components/WorkHistoryList'
import type { WorkHistoryDetail, WorkHistorySummary, WorkTimelineItem } from '../src/models/controlPlane'

const timeline: WorkTimelineItem[] = [
  { id: 'chat', sequence: 1, timestamp: '2026-08-29T00:00:00Z', actor: 'chatgpt', presentation: { title: { kind: 'label', label: 'action.read' }, details: [] } },
  { id: 'agent', sequence: 2, timestamp: '2026-08-29T00:01:00Z', actor: 'subagent', presentation: { title: { kind: 'label', label: 'delegation.prompted' }, details: [] } },
]

describe('Work Detail activity filters', () => {
  it('shows the full timeline for All', () => {
    expect(filterTimelineItems(timeline, 'all').map((item) => item.id)).toEqual(['agent', 'chat'])
  })

  it('separates ChatGPT and Subagent activity', () => {
    expect(filterTimelineItems(timeline, 'chatgpt').map((item) => item.id)).toEqual(['chat'])
    expect(filterTimelineItems(timeline, 'subagent').map((item) => item.id)).toEqual(['agent'])
  })
})


describe('Work Detail availability states', () => {
  it('shows the real partial-data error instead of collapsing Agent / runtime to a generic unavailable state', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const detail: WorkHistoryDetail = {
      id: 'partial',
      title: 'Partial work',
      lastActivityAt: '2026-09-12T00:01:00Z',
      createdAt: '2026-09-12T00:00:00Z',
      eventCount: 0,
      chatCount: 1,
      delegationCount: 0,
      boundIntents: [],
      chatUrls: [],
      timeline: [],
      timelineError: 'timeline transport failed',
    }
    const markup = renderToStaticMarkup(React.createElement(WorkDetail, {
      detail,
      pageContext: null,
      client: {} as never,
    }))
    expect(markup).toContain('timeline transport failed')
    expect(markup).not.toContain('Temporarily unavailable')
  })

  it('keeps terminal Work lookup errors separate from the shared snapshot error state', () => {
    const source = readFileSync(new URL('../src/app/SidePanelApp.tsx', import.meta.url), 'utf8')
    expect(source).toContain('const [detailError, setDetailError]')
    expect(source).toContain("detailError || t('extensionWorkDetailUnavailable')")
    expect(source).toContain('setDetail(null)')
  })

  it('subscribes both Work Details surfaces after initial history and cleans live subscriptions on switch or unmount', () => {
    const sidePanel = readFileSync(new URL('../src/app/SidePanelApp.tsx', import.meta.url), 'utf8')
    const expanded = readFileSync(new URL('../src/app/ExpandedDetailApp.tsx', import.meta.url), 'utf8')
    for (const source of [sidePanel, expanded]) {
      expect(source).toContain('reduce((cursor, item) => Math.max(cursor, item.sequence), 0)')
      expect(source).toContain('subscribeWorkTimeline(')
      expect(source).toContain('mergeWorkHistoryTimeline(')
    }
    expect(sidePanel).toContain('for (const unsubscribe of unsubscribes) unsubscribe()')
    expect(expanded).toContain('unsubscribe?.()')
  })
})

describe('Work Detail intent navigation', () => {
  it('opens a separate intent page and returns to the aggregated conversation detail', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    expect(source).toContain('const [selectedIntentId, setSelectedIntentId]')
    expect(source).toContain('filterWorkHistoryTimelineByIntentScope(detail.timeline, selectedIntent)')
    expect(source).toContain("<ActivityTimeline key={selectedIntent.id} timeline={intentTimeline}")
    expect(source).toContain("onClick={() => setSelectedIntentId(null)}><BackIcon /><span>{t('extensionConversation')}</span>")
    expect(source).toContain('onOpen={() => setSelectedIntentId(scope.id)}')
    expect(source).toContain('<ActivityTimeline key="conversation" timeline={detail.timeline}')
  })

  it('uses stable task provenance as the short intent title and the ChatGPT message as the long detail', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const shared = readFileSync(new URL('../src/__shared/work-history-ui/index.tsx', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8')

    expect(shared).toContain('return intent.task.trim() || intent.message.trim()')
    expect(shared).toContain("const message = intent.message.trim()")
    expect(shared).toContain('<div className="context-card__title">{title}</div>')
    expect(shared).toContain('{detail ? <div className="context-card__preview">{detail}</div> : null}')
    expect(shared).not.toContain('context-card__meta')
    expect(source).toContain('<WorkHistoryIntentDetail intent={selectedIntent.intent} timestamp={selectedIntent.startedAt} formatTimestamp={formatTimestamp} />')
    expect(shared).toContain('export function WorkHistoryIntentDetail')
    expect(shared).toContain('<div className="intent-detail__time"><time>{formatTimestamp(timestamp)}</time></div>')
    expect(shared).toContain('.helm-work-history-ui .intent-detail__time{display:block;min-width:0;margin-top:4px;color:var(--helm-secondary);font-size:11px;line-height:18px;text-align:left}')
    expect(source).not.toContain("t('sessionTaskContext')")
    expect(source).not.toContain('context-card__task')
    expect(source).not.toContain("selectedIntent.kind === 'bound' ? t('sessionBoundChats') : t('sessionOriginChat')")
    expect(styles).not.toContain('.detail-times--intent')
    expect(styles).not.toContain('.intent-detail-message')
  })
})

describe('Work Detail intent disclosure', () => {
  it('shows the intent count in metadata and uses an explicit one-click expand control instead of a standalone Session context row', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const boundContexts = source.indexOf('{detail.boundIntents.map')
    const originContext = source.indexOf('{detail.originIntent ? <ContextCard')
    const intentsFact = source.indexOf('<div className="detail-intents-fact">')
    const timeline = source.indexOf('<ActivityTimeline key="conversation"')

    expect(originContext).toBeGreaterThan(-1)
    expect(boundContexts).toBeGreaterThan(originContext)
    expect(intentsFact).toBeGreaterThan(-1)
    expect(intentsFact).toBeLessThan(timeline)
    expect(source).toContain("t('extensionIntents')")
    expect(source).toContain("t('extensionIntentsCount', { count: intentCount })")
    expect(source).toContain('className="secondary-button compact-action detail-intents-toggle"')
    expect(source).toContain('aria-expanded={contextExpanded}')
    expect(source).toContain('contextExpanded ? <WorkHistoryIntentList>')
    expect(source).toContain("setContextExpanded(false)")
    expect(source).not.toContain("t('sessionBoundAt')")
    expect(source).not.toContain("t('sessionBoundChats')")
    expect(source).toContain("t('sessionUnboundContext')")
    expect(source).not.toContain("t('sessionWorkContext')")
    expect(source).not.toContain('detail-section__toggle')
  })

  it('keeps Created and Updated in metadata rows and removes borders from metadata secondary actions', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8')

    expect(source).toContain("<div><dt>{t('sessionCreated')}</dt><dd><time>{formatTimestamp(detail.createdAt)}</time></dd></div>")
    expect(source).toContain("<div><dt>{t('sessionUpdated')}</dt><dd><time>{formatTimestamp(detail.lastActivityAt)}</time></dd></div>")
    expect(source).not.toContain("<div className=\"detail-times\">{t('sessionCreated')}")
    expect(styles).toContain('.detail-facts .secondary-button { border-color: transparent; background: transparent; }')
    expect(styles).toContain('.detail-facts .secondary-button:hover:not(:disabled) { border-color: transparent; background: var(--helm-hover); }')
  })
})



describe('Work Detail narrow-width layout', () => {
  it('wraps long activity content and keeps extension and standalone surfaces vertical-scroll-only', () => {
    const styles = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8')
    const shared = readFileSync(new URL('../src/__shared/work-history-ui/index.tsx', import.meta.url), 'utf8')
    const previewStyles = readFileSync(new URL('../preview/preview.css', import.meta.url), 'utf8')

    expect(styles).toContain('.work-history-region { min-width: 0; min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden;')
    expect(styles).toContain('.work-detail { width: 100%; max-width: 100%; min-width: 0;')
    expect(shared).toContain('.helm-work-history-ui .timeline-item{box-sizing:border-box;width:100%;max-width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);')
    expect(shared).not.toContain('grid-template-columns:minmax(0,74px) minmax(0,76px) minmax(0,1fr)')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__meta{min-width:0;display:flex;align-items:flex-start;justify-content:space-between;')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__meta-main{min-width:0;display:flex;flex-wrap:wrap;align-items:center;')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__meta time{flex:none;')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__content{width:100%;min-width:0;margin-top:7px;overflow-wrap:anywhere;')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__secondary span{min-width:0;max-width:100%;overflow-wrap:anywhere}')
    expect(shared).toContain('.helm-work-history-ui .context-card__title{min-width:0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;')
    expect(shared).toContain('.helm-work-history-ui .context-card__preview{min-width:0;margin-top:4px;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;')
    expect(shared).not.toContain('context-card__meta')
    expect(shared).toContain('.helm-work-history-ui.intent-list{box-sizing:border-box;width:100%;max-height:240px;overflow-y:auto;overflow-x:hidden;')
    expect(styles).not.toContain('.detail-intent-list')
    expect(shared).toContain('.helm-work-history-ui.context-card{box-sizing:border-box;min-width:0;width:100%;padding:12px 20px;border:0;border-bottom:1px solid var(--helm-border);')
    expect(shared).toContain('.helm-work-history-ui.context-card:last-child{border-bottom:0}')
    expect(shared).toContain('.helm-work-history-ui.context-card:hover,.helm-work-history-ui.context-card:focus-visible{background:var(--helm-hover);outline:none}')
    expect(shared).toContain('.helm-work-history-ui .timeline{box-sizing:border-box;width:100%;max-width:100%;min-width:0;display:flex;flex-direction:column;padding:6px 0 22px}')
    expect(shared).toContain('.helm-work-history-ui .timeline-item:hover{background:var(--helm-hover)}')
    expect(styles).not.toContain('.expanded-shell .helm-work-history-ui.context-card')
    expect(styles).toContain('.expanded-shell .helm-work-history-ui .timeline { padding-left: 0; padding-right: 0; }')
    expect(styles).toContain('.expanded-shell .helm-work-history-ui .timeline-item { padding-left: 24px; padding-right: 24px; }')
    expect(styles).toContain('.expanded-shell { width: min(920px, 100%); max-width: 100%; min-width: 0;')
    expect(previewStyles).toContain('.preview-sidepanel { width: min(390px, 100%); max-width: 100%; min-width: 0;')
    expect(previewStyles).toContain('overflow-y: auto; overflow-x: hidden;')
    expect(previewStyles).toContain('.preview-expanded { width: min(920px, 100%); max-width: 100%; min-width: 0;')
  })

})

describe('Work Detail activity item layout', () => {
  it('renders time first, then duration, status and label, with content on the full-width row below', () => {
    const shared = readFileSync(new URL('../src/__shared/work-history-ui/index.tsx', import.meta.url), 'utf8')
    const meta = shared.indexOf('<div className="timeline-item__meta">')
    const time = shared.indexOf('<time>{formatTimestamp(item.timestamp)}</time>', meta)
    const metaMain = shared.indexOf('<div className="timeline-item__meta-main">', meta)
    const durations = shared.indexOf('{details.durations.length', metaMain)
    const statuses = shared.indexOf('{details.statuses.map', metaMain)
    const actor = shared.indexOf('<span className="actor-badge">', metaMain)
    const content = shared.indexOf('<div className="timeline-item__content">', meta)

    expect(meta).toBeGreaterThan(-1)
    expect(time).toBeGreaterThan(meta)
    expect(metaMain).toBeGreaterThan(time)
    expect(durations).toBeGreaterThan(metaMain)
    expect(statuses).toBeGreaterThan(durations)
    expect(actor).toBeGreaterThan(statuses)
    expect(content).toBeGreaterThan(actor)
    expect(shared).toContain("detail.kind !== 'status' && detail.kind !== 'duration' && detail.kind !== 'tool' && detail.kind !== 'workspace'")
    expect(shared).toContain('runningDuration !== undefined ? <span>{formatWorkHistoryDuration(runningDuration)}</span> : null')
  })


  it('clamps only long Activity primary detail text to three lines and exposes expand/collapse on overflow', () => {
    const shared = readFileSync(new URL('../src/__shared/work-history-ui/index.tsx', import.meta.url), 'utf8')

    expect(shared).toContain('function ExpandableActivityDetail({ text, expandLabel, collapseLabel }')
    expect(shared).toContain('const [expanded, setExpanded] = useState(false)')
    expect(shared).toContain('const [overflowing, setOverflowing] = useState(false)')
    expect(shared).toContain('detail.scrollHeight > detail.clientHeight + 1')
    expect(shared).toContain("typeof ResizeObserver === 'undefined'")
    expect(shared).toContain('className="timeline-item__primary-shell" data-expanded={expanded}')
    expect(shared).toContain('className="timeline-item__primary timeline-item__primary--collapsed"')
    expect(shared).toContain('className="timeline-item__primary timeline-item__primary--expanded"')
    expect(shared).toContain('item.presentation.primary ? <ExpandableActivityDetail text={item.presentation.primary} expandLabel={labels.expand} collapseLabel={labels.collapse} /> : null')
    expect(shared).toContain('className="timeline-item__toggle timeline-item__toggle--collapsed"')
    expect(shared).toContain('<span aria-hidden="true">… </span>{expandLabel}')
    expect(shared).toContain('className="timeline-item__toggle timeline-item__toggle--inline"')
    expect(shared).toContain('{collapseLabel}</button>')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__primary--collapsed{max-height:57px;overflow:hidden}')
    expect(shared).not.toContain('timeline-item__toggle-label')
    expect(shared).not.toContain('text-decoration:underline')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__toggle:hover{background:var(--helm-hover);color:inherit}')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__toggle--collapsed{position:absolute;right:0;bottom:0;z-index:1;background:var(--helm-surface)}')
    expect(shared).toContain('.helm-work-history-ui .timeline-item__toggle--collapsed::before{content:"";position:absolute;top:0;right:100%;bottom:0;width:18px;background:var(--helm-surface);pointer-events:none}')
    expect(shared).toContain('.helm-work-history-ui .timeline-item:hover .timeline-item__toggle--collapsed,.helm-work-history-ui .timeline-item:hover .timeline-item__toggle--collapsed::before{background:linear-gradient(var(--helm-hover),var(--helm-hover)),var(--helm-surface)}')
    expect(shared).not.toContain('.timeline-item:hover .timeline-item__toggle--collapsed{background:var(--helm-hover)')
    expect(shared).not.toContain('.timeline-item__content-body')
  })

})

describe('Work Detail conversation binding placement', () => {
  it('keeps Chrome-only conversation state in metadata without the misleading Activity summary row', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const summary = source.indexOf('<section className="detail-summary">')
    const chatgpt = source.indexOf('<div className="detail-chatgpt-fact">')
    const timeline = source.indexOf('<ActivityTimeline key="conversation"')

    expect(summary).toBeGreaterThan(-1)
    expect(chatgpt).toBeGreaterThan(summary)
    expect(chatgpt).toBeLessThan(timeline)
    expect(source).not.toContain("<dt>{t('extensionActivity')}</dt>")
    expect(source).not.toContain("t('extensionActivitiesCount'")
    expect(source).not.toContain('detail-conversation-header')
    expect(source).not.toContain('>{currentConversation}<')
    expect(source).toContain("t('extensionConversationNotLinked')")
    expect(source).toContain("t('extensionConversationLinkedElsewhere')")
  })
})


const currentWork: WorkHistorySummary = {
  id: 'current', title: 'Current work', lastActivityAt: '2026-08-31T00:00:00Z', eventCount: 1, chatCount: 1, delegationCount: 0,
}
const otherWork: WorkHistorySummary = {
  id: 'other', title: 'Other work', lastActivityAt: '2026-08-30T00:00:00Z', eventCount: 1, chatCount: 0, delegationCount: 0,
}

describe('Work History section labels', () => {
  it('keeps Recent Work visible when there is no linked current conversation', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const markup = renderToStaticMarkup(React.createElement(WorkHistoryList, {
      works: [otherWork],
      currentConversationWork: null,
      onSelect: () => {},
    }))
    expect(markup).toContain('Recent Work')
    expect(markup).not.toContain('Current conversation')
  })

  it('keeps each Work card to title plus time/ChatURL binding state and removes fixed low-value labels', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const linkedWork = { ...otherWork, id: 'linked-work', title: 'Linked work', chatCount: 1, chatUrls: ['https://chatgpt.com/c/linked'] }
    const unlinkedWithHistoricalCount = { ...otherWork, id: 'unlinked-work', title: 'Unlinked work', chatCount: 3, chatUrls: [] }
    const markup = renderToStaticMarkup(React.createElement(WorkHistoryList, {
      works: [linkedWork, unlinkedWithHistoricalCount],
      currentConversationWork: null,
      onSelect: () => {},
    }))
    const styles = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8')
    const shared = readFileSync(new URL('../src/__shared/work-history-ui/index.tsx', import.meta.url), 'utf8')

    expect(markup).not.toContain('Recent activity')
    expect(markup).not.toContain('conversations')
    expect(markup.match(/>Linked</g)).toHaveLength(1)
    expect(markup.match(/>Unlinked</g)).toHaveLength(1)
    expect(markup).toContain('work-card__linked-state work-card__linked-state--linked')
    expect(shared).toContain('.helm-work-history-ui .work-card__title{min-width:0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;')
    expect(shared).toContain('.helm-work-history-ui .work-card__meta{min-width:0;margin-top:5px;display:flex;align-items:center;justify-content:space-between;')
    expect(shared).toContain('.helm-work-history-ui.work-card{box-sizing:border-box;width:100%;padding:12px 20px;border:0;border-bottom:1px solid var(--helm-border);')
    expect(shared).toContain('.helm-work-history-ui.work-card:last-child{border-bottom:0}')
    expect(styles).toContain('.sidepanel-section-heading { min-height: 50px;')
    expect(styles).toContain('.work-history-region { min-width: 0; min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0; }')
    expect(shared).toContain('.helm-work-history-ui.work-card:hover,.helm-work-history-ui.work-card:focus-visible{background:var(--helm-hover);outline:none}')
    expect(shared).not.toContain('.work-card--current{border-color:')
    expect(shared).toContain('.helm-work-history-ui .work-card__linked-state--linked{font-weight:650;color:var(--helm-business)}')
  })
})

describe('Work History current conversation projection', () => {
  it('pins the current-conversation Work without duplicating it in Recent Work', () => {
    const model = partitionWorkHistoryByCurrentConversation([currentWork, otherWork], currentWork)
    expect(model.current?.id).toBe('current')
    expect(model.recent.map((work) => work.id)).toEqual(['other'])
  })

  it('uses the Core-projected conversation identity instead of inferring membership in the UI', () => {
    const grouped: WorkHistorySummary = {
      id: 'latest-member',
      title: 'Latest member',
      lastActivityAt: '2026-09-16T00:00:00Z',
      eventCount: 2,
      chatCount: 1,
      delegationCount: 0,
      chatUrls: ['https://chatgpt.com/c/shared'],
      workIds: ['latest-member', 'current'],
    }
    const model = partitionWorkHistoryByCurrentConversation([grouped, otherWork], { ...grouped })
    expect(model.current?.id).toBe('latest-member')
    expect(model.recent.map((work) => work.id)).toEqual(['other'])
  })

  it('does not group different backend identities just because their browser URLs match', () => {
    const sameUrlDifferentIdentity: WorkHistorySummary = {
      ...currentWork,
      id: 'different-backend-identity',
      chatUrls: ['https://chatgpt.com/c/current'],
    }
    const model = partitionWorkHistoryByCurrentConversation([sameUrlDifferentIdentity, otherWork], currentWork)
    expect(model.current?.id).toBe('current')
    expect(model.recent.map((work) => work.id)).toEqual(['different-backend-identity', 'other'])
  })

  it('can pin a current-conversation Work even when it is outside the loaded page or workspace filter', () => {
    const model = partitionWorkHistoryByCurrentConversation([otherWork], currentWork)
    expect(model.current?.id).toBe('current')
    expect(model.recent.map((work) => work.id)).toEqual(['other'])
  })
})
