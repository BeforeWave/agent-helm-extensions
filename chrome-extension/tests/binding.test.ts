import { describe, expect, it } from 'vitest'
import { MockAgentHelmService } from '../src/adapters/mock/MockAgentHelmService'
import { NativeAgentHelmService } from '../src/adapters/chrome/NativeAgentHelmService'
import type { PageContext } from '../src/models/controlPlane'

const pageContext: PageContext = {
  kind: 'conversation',
  url: 'https://chatgpt.com/c/new-conversation?temporary=1',
  conversationUrl: 'https://chatgpt.com/c/new-conversation',
  title: 'New conversation',
  tabId: 1,
  windowId: 1,
  active: true,
}

describe('mock service conversation binding', () => {
  it('is idempotent for the same conversation and Work History record', async () => {
    const service = new MockAgentHelmService()
    expect(await service.findWorkByConversation(pageContext)).toBeNull()

    const first = await service.bindConversation('work-browser-extension', pageContext)
    const second = await service.bindConversation('work-browser-extension', pageContext)
    const owner = await service.findWorkByConversation(pageContext)

    expect(first.chatUrls).toContain('https://chatgpt.com/c/new-conversation')
    expect(second.chatUrls.filter((url) => url === 'https://chatgpt.com/c/new-conversation')).toHaveLength(1)
    expect(second.boundIntents).toHaveLength(0)
    expect(owner?.id).toBe('work-browser-extension')
  })

  it('prevents the same browser conversation from being linked to a second Work', async () => {
    const service = new MockAgentHelmService()
    await service.bindConversation('work-browser-extension', pageContext)
    await expect(service.bindConversation('work-tunnel-errors', pageContext)).rejects.toThrow('already linked')
    expect((await service.findWorkByConversation(pageContext))?.id).toBe('work-browser-extension')
  })

  it('rejects invalid page context', async () => {
    const service = new MockAgentHelmService()
    await expect(service.bindConversation('work-browser-extension', { ...pageContext, kind: 'other', url: 'https://example.com/', conversationUrl: null })).rejects.toThrow('not a ChatGPT conversation')
  })
})


describe('native Chrome conversation binding', () => {
  const nativeSummary = {
    id: 'session-native',
    originIntent: { message: 'Native binding', task: 'Associate browser URL only.' },
    boundIntents: [],
    chatUrls: ['https://chatgpt.com/c/new-conversation'],
    activeWorkspaceId: 'workspace-native',
    workspace: { id: 'workspace-native', title: 'example-project' },
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:01:00.000Z',
    lastActivityAt: '2026-08-30T00:01:00.000Z',
    eventCount: 0,
    delegationCount: 0,
    chatCount: 1,
  }

  it('looks up the Work already linked to the current browser conversation through the Native Host', async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = []
    const service = new NativeAgentHelmService({
      async request(method: string, params?: unknown[]) {
        requests.push({ method, params })
        if (method === 'findChatSessionSummaryByUrl') return nativeSummary
        throw new Error('Unexpected native method: ' + method)
      },
    } as never)

    const owner = await service.findWorkByConversation(pageContext)
    expect(requests).toEqual([{ method: 'findChatSessionSummaryByUrl', params: ['https://chatgpt.com/c/new-conversation'] }])
    expect(owner?.id).toBe('session-native')
    expect(owner?.title).toBe('Native binding')
  })

  it('associates the current ChatGPT URL through the Native Host and refreshes Work Detail', async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = []
    const transport = {
      async request(method: string, params?: unknown[]) {
        requests.push({ method, params })
        if (method === 'bindChatUrl') return { id: 'session-native' }
        if (method === 'getChatSessionSummary') return nativeSummary
        if (method === 'getChatSessionTimeline') return []
        throw new Error('Unexpected native method: ' + method)
      },
    }

    const service = new NativeAgentHelmService(transport as never)
    const detail = await service.bindConversation('session-native', pageContext)

    expect(requests[0]).toEqual({
      method: 'bindChatUrl',
      params: ['session-native', 'https://chatgpt.com/c/new-conversation'],
    })
    expect(detail.chatUrls).toEqual(['https://chatgpt.com/c/new-conversation'])
    expect(detail.chatCount).toBe(1)
  })

  it('rejects non-conversation pages before calling the Native Host', async () => {
    let called = false
    const service = new NativeAgentHelmService({
      async request() { called = true; throw new Error('must not be called') },
    } as never)

    await expect(service.bindConversation('session-native', {
      ...pageContext,
      kind: 'other',
      url: 'https://example.com/',
      conversationUrl: null,
    })).rejects.toThrow('not a ChatGPT conversation')
    expect(called).toBe(false)
  })
})
