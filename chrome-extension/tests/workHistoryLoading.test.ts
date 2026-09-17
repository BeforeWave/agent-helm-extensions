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
    expect(hookSource).toContain('[client, currentUrl, pageContextResolved, enabled, refreshVersion]')
    expect(sidePanelSource).toContain("void client.getWorkHistoryPage().then((page) =>")
    expect(sidePanelSource).toContain("items: workHistoryState.works")
    expect(sidePanelSource).not.toContain("items: snapshot?.works ?? []")
    expect(sidePanelSource).toContain("workHistoryState.works.find((work) => work.chatUrls?.includes(currentConversationUrl))")
    expect(sidePanelSource).toContain("Boolean(coreRunning && workHistoryState.loaded && currentConversationUrl && !loadedCurrentConversationWork)")
    expect(sidePanelSource).toContain("(coreRunning && !workHistoryState.loaded)")
    expect(sidePanelSource).toContain('aria-busy={workHistoryLoading}')
    expect(sidePanelSource).toContain('client.subscribeWorkHistoryChanges(refreshFirstPage)')
    expect(sidePanelSource).toContain('mergeWorkHistorySessionPage(current.works, page.works)')
    expect(sidePanelSource).toContain('nextCursor: page.nextCursor ? String(works.length) : undefined')
    expect(sidePanelSource).not.toContain('WORK_HISTORY_LIST_REFRESH_MS')

    const loadingBranch = sidePanelSource.indexOf('{workHistoryLoading')
    const list = sidePanelSource.indexOf('<WorkHistoryList')
    expect(loadingBranch).toBeGreaterThan(-1)
    expect(list).toBeGreaterThan(loadingBranch)
  })
})
