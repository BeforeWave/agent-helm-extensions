import { describe, expect, it } from 'vitest'
import { normalizeWorkHistorySession, workHistoryTimelinePurpose } from '@beforewave/agent-helm-ui-contract'
import { createWorkHistorySessionDetailModel, createWorkHistorySessionListModel, workHistorySessionTitle } from '../src/models/workHistory'

import { workHistoryTimelineExecutionDetail } from '../src/models/workHistory'

function session(value: Record<string, unknown>) {
  const normalized = normalizeWorkHistorySession(value)
  if (!normalized) throw new Error('invalid Work History fixture')
  return normalized
}

describe('Chrome Work History business components', () => {
  it('uses the immutable origin message then context_id as the only Session title fallback', () => {
    const bound = session({
      id: 'context-bound',
      originIntent: { message: 'Implement shared Work History', task: 'Share business logic.' },
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:01:00.000Z',
      lastActivityAt: '2026-08-30T10:01:00.000Z',
    })
    const unbound = session({
      id: 'context-unbound',
      workspace: { id: 'workspace-a', title: 'This must not become the title' },
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:01:00.000Z',
      lastActivityAt: '2026-08-30T10:01:00.000Z',
    })

    expect(workHistorySessionTitle(bound)).toBe('Implement shared Work History')
    expect(workHistorySessionTitle(unbound)).toBe('context-unbound')
  })

  it('owns Workspace selection, Session filtering, and selected-context reconciliation', () => {
    const sessions = [
      session({ id: 'context-a', workspace: { id: 'workspace-a', title: 'Alpha' }, lastActivityAt: '2026-08-30T10:00:00.000Z' }),
      session({ id: 'context-b', workspace: { id: 'workspace-b', title: 'Beta' }, lastActivityAt: '2026-08-30T11:00:00.000Z' }),
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


  it('uses JSONL purpose before normalized activity type', () => {
    expect(workHistoryTimelinePurpose({
      kind: 'work',
      actionType: 'command',
      arguments: { purpose: 'Run targeted verification for Work History pagination' },
    })).toBe('Run targeted verification for Work History pagination')
    expect(workHistoryTimelinePurpose({ kind: 'work', actionType: 'command', arguments: {} })).toBeUndefined()
  })

  it('keeps execution facts separate from purpose instead of inferring business intent', () => {
    const withPurpose = {
      kind: 'work',
      actionType: 'edit',
      tool: 'semantic_replace_symbol_body',
      primaryObject: 'SidePanelApp.tsx',
      arguments: { purpose: 'Apply the requested Workspace availability behavior' },
    }
    expect(workHistoryTimelinePurpose(withPurpose)).toBe('Apply the requested Workspace availability behavior')
    expect(workHistoryTimelineExecutionDetail(withPurpose)).toBe('semantic_replace_symbol_body · SidePanelApp.tsx')

    const withoutPurpose = {
      kind: 'work',
      actionType: 'edit',
      tool: 'semantic_replace_symbol_body',
      primaryObject: 'SidePanelApp.tsx',
      arguments: {},
    }
    expect(workHistoryTimelinePurpose(withoutPurpose)).toBeUndefined()
    expect(workHistoryTimelineExecutionDetail(withoutPurpose)).toBe('semantic_replace_symbol_body · SidePanelApp.tsx')
  })

  it('owns canonical Session detail projection and legacy summary compatibility', () => {
    const legacy = session({
      id: 'context-legacy',
      originChat: { message: 'Legacy intent', task: 'Keep compatibility', url: 'https://chatgpt.com/c/origin' },
      boundChats: [{ message: 'Follow-up', task: 'Continue work', url: 'https://chatgpt.com/c/bound', boundAt: '2026-08-30T12:00:00.000Z' }],
      workspace: { id: 'workspace-a', title: 'Alpha' },
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
      lastActivityAt: '2026-08-30T12:00:00.000Z',
      eventCount: 2,
      chatCount: 2,
    })
    const detail = createWorkHistorySessionDetailModel(legacy)

    expect(detail.title).toBe('Legacy intent')
    expect(detail.originIntent).toEqual({ message: 'Legacy intent', task: 'Keep compatibility' })
    expect(detail.boundIntents).toEqual([{ intent: { message: 'Follow-up', task: 'Continue work' }, boundAt: '2026-08-30T12:00:00.000Z' }])
    expect(detail.chatUrls).toEqual(['https://chatgpt.com/c/origin', 'https://chatgpt.com/c/bound'])
  })
})
