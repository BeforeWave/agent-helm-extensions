import { describe, expect, it } from 'vitest'
import { normalizeWorkHistorySession, normalizeWorkHistoryTimelinePresentation } from '../src/ui-contract'
import { createWorkHistoryIntentActivityScopes, createWorkHistorySessionDetailModel, createWorkHistorySessionListModel, filterWorkHistoryTimelineByIntentScope, mergeWorkHistoryConversationDetail } from '../src/models/workHistory'
import type { WorkHistoryDetail, WorkHistorySummary } from '../src/models/controlPlane'

function session(value: Record<string, unknown>) {
  const normalized = normalizeWorkHistorySession(value)
  if (!normalized) throw new Error('invalid Work History fixture')
  return normalized
}

describe('Chrome Work History business components', () => {
  it('renders the Core-selected Session title instead of re-deriving it from intents', () => {
    const bound = session({
      id: 'context-bound',
      originIntent: { message: 'Implement shared Work History', task: 'Share business logic.' },
      boundIntents: [
        { intent: { message: 'Continue shared Work History', task: 'Use latest context.' }, boundAt: '2026-08-30T10:02:00.000Z' },
      ],
      presentation: { title: 'Core-selected title' },
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:01:00.000Z',
      lastActivityAt: '2026-08-30T10:01:00.000Z',
    })

    expect(createWorkHistorySessionDetailModel(bound).title).toBe('Core-selected title')
    expect(createWorkHistorySessionListModel({ sessions: [bound] }).items[0]?.title).toBe('Core-selected title')
  })

  it('owns Workspace selection, Session filtering, and selected-context reconciliation', () => {
    const sessions = [
      session({ id: 'context-a', workspace: { id: 'workspace-a', title: 'Alpha' }, presentation: { title: 'A', workspaceLabel: 'Alpha' }, lastActivityAt: '2026-08-30T10:00:00.000Z' }),
      session({ id: 'context-b', workspace: { id: 'workspace-b', title: 'Beta' }, presentation: { title: 'B', workspaceLabel: 'Beta' }, lastActivityAt: '2026-08-30T11:00:00.000Z' }),
    ]
    const model = createWorkHistorySessionListModel({
      sessions,
      workspaceId: 'workspace-b',
      selectedId: 'context-a',
      workspaces: [{ id: 'workspace-c', title: 'Gamma' }],
    })

    expect(model.workspace.options).toEqual([
      { id: 'workspace-a', label: 'Alpha' },
      { id: 'workspace-b', label: 'Beta' },
      { id: 'workspace-c', label: 'Gamma' },
    ])
    expect(model.items.map((item) => item.id)).toEqual(['context-b'])
    expect(model.selectedId).toBe('context-b')
  })

  it('merges grouped conversation detail without losing member-session timeline data', () => {
    const summary: WorkHistorySummary = {
      id: 'new-worktree',
      title: 'Latest task',
      lastActivityAt: '2026-09-16T10:00:00.000Z',
      eventCount: 2,
      chatCount: 1,
      delegationCount: 0,
      chatUrls: ['https://chatgpt.com/c/shared'],
      workIds: ['new-worktree', 'old-worktree'],
    }
    const detail = (id: string, timestamp: string, timelineId: string): WorkHistoryDetail => ({
      id,
      title: id,
      lastActivityAt: timestamp,
      eventCount: 1,
      chatCount: 1,
      delegationCount: 0,
      chatUrls: ['https://chatgpt.com/c/shared'],
      workIds: [id],
      createdAt: timestamp,
      boundIntents: [],
      timeline: [{ id: timelineId, sequence: 1, timestamp, actor: 'chatgpt', presentation: { title: { kind: 'text', text: timelineId }, details: [] } }],
    })

    const merged = mergeWorkHistoryConversationDetail(summary, [
      detail('new-worktree', '2026-09-16T10:00:00.000Z', 'same-local-id'),
      detail('old-worktree', '2026-09-15T10:00:00.000Z', 'same-local-id'),
    ])

    expect(merged.id).toBe('new-worktree')
    expect(merged.chatCount).toBe(1)
    expect(merged.timeline.map((item) => item.id)).toEqual(['old-worktree:same-local-id', 'new-worktree:same-local-id'])
    expect(merged.timeline.map((item) => item.sequence)).toEqual([1, 2])
  })

  it('assigns activity to the intent that was active from bind until the next bind', () => {
    const detail: WorkHistoryDetail = {
      id: 'session-intents',
      title: 'Conversation',
      createdAt: '2026-09-16T10:00:00.000Z',
      lastActivityAt: '2026-09-16T10:12:00.000Z',
      eventCount: 5,
      chatCount: 1,
      delegationCount: 0,
      originIntent: { message: 'Intent A', task: 'A' },
      boundIntents: [
        { intent: { message: 'Intent C', task: 'C' }, boundAt: '2026-09-16T10:10:00.000Z' },
        { intent: { message: 'Intent B', task: 'B' }, boundAt: '2026-09-16T10:05:00.000Z' },
      ],
      chatUrls: ['https://chatgpt.com/c/shared'],
      timeline: [
        { id: 'before', workId: 'session-intents', sequence: 1, timestamp: '2026-09-16T09:59:59.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'before' }, details: [] } },
        { id: 'a', workId: 'session-intents', sequence: 2, timestamp: '2026-09-16T10:01:00.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'a' }, details: [] } },
        { id: 'b-start', workId: 'session-intents', sequence: 3, timestamp: '2026-09-16T10:05:00.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'b' }, details: [] } },
        { id: 'b', workId: 'session-intents', sequence: 4, timestamp: '2026-09-16T10:09:59.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'b2' }, details: [] } },
        { id: 'c-start', workId: 'session-intents', sequence: 5, timestamp: '2026-09-16T10:10:00.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'c' }, details: [] } },
      ],
    }
    const scopes = createWorkHistoryIntentActivityScopes([detail])
    expect(scopes.map((scope) => scope.intent.message)).toEqual(['Intent C', 'Intent B', 'Intent A'])
    const byIntent = Object.fromEntries(scopes.map((scope) => [scope.intent.message, filterWorkHistoryTimelineByIntentScope(detail.timeline, scope).map((item) => item.id)]))
    expect(byIntent).toEqual({
      'Intent A': ['a'],
      'Intent B': ['b-start', 'b'],
      'Intent C': ['c-start'],
    })
    expect(Object.values(byIntent).flat()).not.toContain('before')
  })

  it('keeps one logical intent when the same intent is rebound only because the conversation moved to another work session', () => {
    const detail = (id: string, createdAt: string, intent: string, events: Array<[string, string]>): WorkHistoryDetail => ({
      id,
      title: 'Conversation',
      createdAt,
      lastActivityAt: events.at(-1)?.[1] ?? createdAt,
      eventCount: events.length,
      chatCount: 1,
      delegationCount: 0,
      originIntent: { message: intent, task: intent },
      boundIntents: [],
      chatUrls: ['https://chatgpt.com/c/shared'],
      timeline: events.map(([eventId, timestamp], index) => ({
        id: eventId, workId: id, sequence: index + 1, timestamp, actor: 'chatgpt',
        presentation: { title: { kind: 'text', text: eventId }, details: [] },
      })),
    })
    const first = detail('work-a', '2026-09-16T10:00:00.000Z', 'Intent A', [['a1', '2026-09-16T10:01:00.000Z']])
    const second = detail('work-b', '2026-09-16T10:03:00.000Z', 'Intent A', [['a2', '2026-09-16T10:04:00.000Z']])
    second.boundIntents = [{ intent: { message: 'Intent B', task: 'Intent B' }, boundAt: '2026-09-16T10:05:00.000Z' }]
    second.timeline.push({ id: 'b1', workId: 'work-b', sequence: 2, timestamp: '2026-09-16T10:06:00.000Z', actor: 'chatgpt', presentation: { title: { kind: 'text', text: 'b1' }, details: [] } })

    const scopes = createWorkHistoryIntentActivityScopes([first, second])
    expect(scopes.map((scope) => scope.intent.message)).toEqual(['Intent B', 'Intent A'])
    const timeline = [...first.timeline, ...second.timeline].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    expect(filterWorkHistoryTimelineByIntentScope(timeline, scopes[1]!).map((item) => item.id)).toEqual(['a1', 'a2'])
    expect(filterWorkHistoryTimelineByIntentScope(timeline, scopes[0]!).map((item) => item.id)).toEqual(['b1'])
  })

  it('does not infer intent order when two different intent binds share the same timestamp', () => {
    const detail: WorkHistoryDetail = {
      id: 'ambiguous-intents',
      title: 'Conversation',
      createdAt: '2026-09-16T10:00:00.000Z',
      lastActivityAt: '2026-09-16T10:01:00.000Z',
      eventCount: 0, chatCount: 1, delegationCount: 0,
      originIntent: { message: 'Intent A', task: 'A' },
      boundIntents: [
        { intent: { message: 'Intent B', task: 'B' }, boundAt: '2026-09-16T10:05:00.000Z' },
        { intent: { message: 'Intent C', task: 'C' }, boundAt: '2026-09-16T10:05:00.000Z' },
      ],
      chatUrls: [], timeline: [],
    }
    expect(createWorkHistoryIntentActivityScopes([detail])).toEqual([])
  })

  it('does not create intent activity scopes when a bind boundary is not reliable', () => {
    const detail: WorkHistoryDetail = {
      id: 'session-invalid-intent-boundary',
      title: 'Conversation',
      createdAt: '2026-09-16T10:00:00.000Z',
      lastActivityAt: '2026-09-16T10:12:00.000Z',
      eventCount: 1,
      chatCount: 1,
      delegationCount: 0,
      originIntent: { message: 'Intent A', task: 'A' },
      boundIntents: [{ intent: { message: 'Intent B', task: 'B' }, boundAt: 'not-a-time' }],
      chatUrls: [],
      timeline: [],
    }
    expect(createWorkHistoryIntentActivityScopes([detail])).toEqual([])
  })

  it('uses Core timeline presentation even when raw fields imply another title', () => {
    const presentation = normalizeWorkHistoryTimelinePresentation({
      kind: 'work',
      actionType: 'edit',
      tool: 'semantic_replace_symbol_body',
      primaryObject: 'SidePanelApp.tsx',
      arguments: { purpose: 'Raw purpose that the UI must not choose itself' },
      presentation: {
        title: { kind: 'text', text: 'Core-selected purpose' },
        primary: 'Core-selected primary',
        details: [{ kind: 'status', text: 'success' }],
      },
    })

    expect(presentation).toEqual({
      title: { kind: 'text', text: 'Core-selected purpose' },
      primary: 'Core-selected primary',
      details: [{ kind: 'status', text: 'success' }],
    })
  })

  it('keeps legacy Session compatibility neutral when Core presentation is unavailable', () => {
    const legacy = session({
      id: 'context-legacy',
      originChat: { message: 'Legacy intent', task: 'Keep compatibility', url: 'https://chatgpt.com/c/origin' },
      boundChats: [
        { message: 'Follow-up', task: 'Continue work', url: 'https://chatgpt.com/c/bound', boundAt: '2026-08-30T12:00:00.000Z' },
        { message: 'Latest follow-up', task: 'Finish work', url: 'https://chatgpt.com/c/latest', boundAt: '2026-08-30T13:00:00.000Z' },
      ],
      workspace: { id: 'workspace-a', title: 'Alpha' },
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      lastActivityAt: '2026-08-30T12:00:00.000Z',
      eventCount: 2,
      chatCount: 2,
    })
    const detail = createWorkHistorySessionDetailModel(legacy)

    expect(detail.title).toBe('context-legacy')
    expect(detail.originIntent).toEqual({ message: 'Legacy intent', task: 'Keep compatibility' })
    expect(detail.boundIntents).toEqual([
      { intent: { message: 'Latest follow-up', task: 'Finish work' }, boundAt: '2026-08-30T13:00:00.000Z' },
      { intent: { message: 'Follow-up', task: 'Continue work' }, boundAt: '2026-08-30T12:00:00.000Z' },
    ])
    expect(detail.chatUrls).toEqual(['https://chatgpt.com/c/origin', 'https://chatgpt.com/c/bound', 'https://chatgpt.com/c/latest'])
  })
})
