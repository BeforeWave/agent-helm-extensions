import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterTimelineItems } from '../src/components/WorkDetail'
import { partitionWorkHistoryByCurrentConversation } from '../src/components/WorkHistoryList'
import type { WorkHistorySummary, WorkTimelineItem } from '../src/models/controlPlane'

const timeline: WorkTimelineItem[] = [
  { id: 'chat', timestamp: '2026-08-29T00:00:00Z', actor: 'chatgpt', action: 'Read' },
  { id: 'agent', timestamp: '2026-08-29T00:01:00Z', actor: 'subagent', action: 'Prompt' },
]

describe('Work Detail activity filters', () => {
  it('shows the full timeline for All', () => {
    expect(filterTimelineItems(timeline, 'all').map((item) => item.id)).toEqual(['chat', 'agent'])
  })

  it('separates ChatGPT and Subagent activity', () => {
    expect(filterTimelineItems(timeline, 'chatgpt').map((item) => item.id)).toEqual(['chat'])
    expect(filterTimelineItems(timeline, 'subagent').map((item) => item.id)).toEqual(['agent'])
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
