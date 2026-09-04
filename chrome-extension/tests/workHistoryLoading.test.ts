import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isCurrentConversationResolved } from '../src/features/useControlPlane'

describe('Work History current-conversation loading', () => {
  it('does not resolve before page context and linked Work are known', () => {
    expect(isCurrentConversationResolved({
      pageContextResolved: false,
      currentUrl: null,
      lookupUrl: null,
      lookupResolved: false,
    })).toBe(false)

    expect(isCurrentConversationResolved({
      pageContextResolved: true,
      currentUrl: 'https://chatgpt.com/c/current',
      lookupUrl: null,
      lookupResolved: false,
    })).toBe(false)

    expect(isCurrentConversationResolved({
      pageContextResolved: true,
      currentUrl: 'https://chatgpt.com/c/current',
      lookupUrl: 'https://chatgpt.com/c/previous',
      lookupResolved: true,
    })).toBe(false)

    expect(isCurrentConversationResolved({
      pageContextResolved: true,
      currentUrl: 'https://chatgpt.com/c/current',
      lookupUrl: 'https://chatgpt.com/c/current',
      lookupResolved: true,
    })).toBe(true)

    expect(isCurrentConversationResolved({
      pageContextResolved: true,
      currentUrl: null,
      lookupUrl: null,
      lookupResolved: false,
    })).toBe(true)
  })

  it('keeps the whole Side Panel Work History region loading until resolution completes', () => {
    const hookSource = readFileSync(new URL('../src/features/useControlPlane.ts', import.meta.url), 'utf8')
    const sidePanelSource = readFileSync(new URL('../src/app/SidePanelApp.tsx', import.meta.url), 'utf8')

    expect(hookSource).toContain('{ value: null, resolved: false }')
    expect(hookSource.indexOf('const unsubscribe = client.subscribePageContext')).toBeLessThan(hookSource.indexOf('void client.getCurrentPageContext()'))
    expect(hookSource).toContain('subscriptionObserved')
    expect(hookSource).toContain('[client, currentUrl, pageContextResolved, refreshVersion]')
    expect(sidePanelSource).toContain('const workHistoryLoading = (loading && !snapshot) || !currentConversation.resolved')
    expect(sidePanelSource).toContain('aria-busy={workHistoryLoading}')

    const loadingBranch = sidePanelSource.indexOf('{workHistoryLoading')
    const list = sidePanelSource.indexOf('<WorkHistoryList')
    expect(loadingBranch).toBeGreaterThan(-1)
    expect(list).toBeGreaterThan(loadingBranch)
  })
})
