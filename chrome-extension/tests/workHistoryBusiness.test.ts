import { describe, expect, it } from 'vitest'
import { normalizeWorkHistorySession, normalizeWorkHistoryTimelinePresentation } from '@beforewave/agent-helm-ui-contract'
import { createWorkHistorySessionDetailModel, createWorkHistorySessionListModel } from '../src/models/workHistory'

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
