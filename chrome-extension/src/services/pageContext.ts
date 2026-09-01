import type { PageContext } from '../models/controlPlane'

export interface PageTabMetadata {
  id?: number
  windowId?: number
  title?: string
  url?: string
  active?: boolean
}

const CHATGPT_HOST = 'chatgpt.com'

export function normalizeChatGPTConversationUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== CHATGPT_HOST) return null

  const parts = url.pathname.split('/').filter(Boolean)
  const directConversation = parts.length === 2 && parts[0] === 'c' && Boolean(parts[1])
  const scopedConversation = parts.length === 4 && parts[0] === 'g' && Boolean(parts[1]) && parts[2] === 'c' && Boolean(parts[3])
  if (!directConversation && !scopedConversation) return null

  return `https://chatgpt.com/${parts.join('/')}`
}

export function classifyChatGPTPage(value: string): Pick<PageContext, 'kind' | 'url' | 'conversationUrl'> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { kind: 'other', url: null, conversationUrl: null }
  }
  if (url.protocol !== 'https:' || url.hostname !== CHATGPT_HOST) {
    return { kind: 'other', url: null, conversationUrl: null }
  }
  const conversationUrl = normalizeChatGPTConversationUrl(url.href)
  return {
    kind: conversationUrl ? 'conversation' : 'chatgpt',
    url: conversationUrl,
    conversationUrl,
  }
}

export function pageContextFromTab(tab: PageTabMetadata): PageContext {
  const classified = classifyChatGPTPage(tab.url ?? '')
  return {
    ...classified,
    tabId: typeof tab.id === 'number' ? tab.id : null,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
    title: classified.kind === 'other' ? '' : tab.title ?? '',
    active: Boolean(tab.active),
  }
}
