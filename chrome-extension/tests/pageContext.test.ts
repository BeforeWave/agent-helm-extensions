import { describe, expect, it } from 'vitest'
import { classifyChatGPTPage, normalizeChatGPTConversationUrl } from '../src/services/pageContext'

describe('ChatGPT page recognition', () => {
  it('normalizes ordinary ChatGPT conversation URLs and removes query/hash', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/c/abc123?utm_source=test#tail')).toBe('https://chatgpt.com/c/abc123')
    expect(normalizeChatGPTConversationUrl('https://www.chatgpt.com/c/abc123/')).toBe('https://chatgpt.com/c/abc123')
  })

  it('preserves scoped GPT conversation routes without treating their ids as execution authority', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/g/g-project/c/conversation-id?x=1')).toBe('https://chatgpt.com/g/g-project/c/conversation-id')
  })

  it('rejects non-conversation and non-ChatGPT pages', () => {
    expect(normalizeChatGPTConversationUrl('https://chatgpt.com/')).toBeNull()
    expect(normalizeChatGPTConversationUrl('https://example.com/c/abc123')).toBeNull()
    expect(classifyChatGPTPage('https://chatgpt.com/').kind).toBe('chatgpt')
    expect(classifyChatGPTPage('https://example.com/').kind).toBe('other')
  })
})
