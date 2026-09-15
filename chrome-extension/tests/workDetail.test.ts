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
      expect(source).toContain('unsubscribe?.()')
    }
  })
})

describe('Work Detail context ordering', () => {
  it('renders immutable origin provenance before additional contexts', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const boundContexts = source.indexOf('{detail.boundIntents.map')
    const originContext = source.indexOf('{detail.originIntent ? <ContextCard')

    expect(originContext).toBeGreaterThan(-1)
    expect(boundContexts).toBeGreaterThan(originContext)
    expect(source).toContain("t('sessionWorkContext')")
    expect(source).toContain('data-expanded={contextExpanded}')
    expect(source).toContain("setContextExpanded(false)")
    expect(source).toContain("t('sessionBoundAt')")
    expect(source).toContain("t('sessionBoundChats')")
    expect(source).toContain("t('sessionUnboundContext')")
    expect(source).not.toContain("t('extensionOriginContext')")
  })
})


describe('Work Detail conversation binding placement', () => {
  it('keeps Chrome-only conversation state as the fourth metadata row below Workspace / Agent / Activity', () => {
    const source = readFileSync(new URL('../src/components/WorkDetail.tsx', import.meta.url), 'utf8')
    const summary = source.indexOf('<section className="detail-summary">')
    const activity = source.indexOf("<dt>{t('extensionActivity')}</dt>")
    const chatgpt = source.indexOf('<div className="detail-chatgpt-fact">')
    const timeline = source.indexOf('<section className="timeline-section">')

    expect(summary).toBeGreaterThan(-1)
    expect(activity).toBeGreaterThan(summary)
    expect(chatgpt).toBeGreaterThan(activity)
    expect(chatgpt).toBeLessThan(timeline)
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
})

describe('Work History current conversation projection', () => {
  it('pins the current-conversation Work without duplicating it in Recent Work', () => {
    const model = partitionWorkHistoryByCurrentConversation([currentWork, otherWork], currentWork)
    expect(model.current?.id).toBe('current')
    expect(model.recent.map((work) => work.id)).toEqual(['other'])
  })

  it('can pin a current-conversation Work even when it is outside the loaded page or workspace filter', () => {
    const model = partitionWorkHistoryByCurrentConversation([otherWork], currentWork)
    expect(model.current?.id).toBe('current')
    expect(model.recent.map((work) => work.id)).toEqual(['other'])
  })
})
