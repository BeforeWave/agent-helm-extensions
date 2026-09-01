import { describe, expect, it } from 'vitest'
import { classifyChatGPTPage, normalizeChatGPTConversationUrl, pageContextFromTab } from '../src/services/pageContext'

describe('ChatGPT page recognition', () => {
  it('normalizes ordinary ChatGPT conversation URLs and removes query/hash', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/c/abc123?utm_source=test#tail')).toBe('https://chatgpt.com/c/abc123')
    expect(normalizeChatGPTConversationUrl('https://www.chatgpt.com/c/abc123/')).toBeNull()
  })

  it('preserves scoped GPT conversation routes without treating their ids as execution authority', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/g/g-project/c/conversation-id?x=1')).toBe('https://chatgpt.com/g/g-project/c/conversation-id')
  })

  it('rejects non-conversation and non-ChatGPT pages', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/')).toBeNull()
    expect(normalizeChatGPTConversationUrl('https://example.com/c/abc123')).toBeNull()
    expect(classifyChatGPTPage('https://chatgpt.com/')).toEqual({ kind: 'chatgpt', url: null, conversationUrl: null })
    expect(classifyChatGPTPage('https://example.com/private/path?token=secret')).toEqual({ kind: 'other', url: null, conversationUrl: null })
  })

  it('never exposes ordinary-site URL or title metadata', () => {
    expect(pageContextFromTab({
      id: 7,
      windowId: 2,
      active: true,
      url: 'https://example.com/private/path?token=secret',
      title: 'Private page title',
    })).toEqual({
      kind: 'other',
      url: null,
      conversationUrl: null,
      title: '',
      tabId: 7,
      windowId: 2,
      active: true,
    })
  })

  it('keeps only the normalized ChatGPT Conversation URL while preserving tab state', () => {
    expect(pageContextFromTab({
      id: 8,
      windowId: 2,
      active: true,
      url: 'https://chatgpt.com/c/abc123?utm_source=test#tail',
      title: 'Conversation title',
    })).toEqual({
      kind: 'conversation',
      url: 'https://chatgpt.com/c/abc123',
      conversationUrl: 'https://chatgpt.com/c/abc123',
      title: 'Conversation title',
      tabId: 8,
      windowId: 2,
      active: true,
    })
  })
})
