import { useEffect, useMemo, useState } from 'react'
import { NativeAgentHelmService } from '../src/adapters/chrome/NativeAgentHelmService'
import { HttpNativeTransport } from '../src/adapters/standalone/HttpNativeTransport'
import { StandaloneAgentHelmService } from '../src/adapters/standalone/StandaloneAgentHelmService'
import { StandaloneBrowserCapabilities } from '../src/adapters/standalone/StandaloneBrowserCapabilities'
import { ExpandedDetailApp } from '../src/app/ExpandedDetailApp'
import { PopupApp } from '../src/app/PopupApp'
import { SidePanelApp } from '../src/app/SidePanelApp'
import { BrowserControlPlaneClient } from '../src/client/BrowserControlPlaneClient'
import { helmLocale, type HelmLocale } from '../src/locale'

type StandaloneSurface = 'sidepanel' | 'popup' | 'expanded'
type StandaloneTheme = 'light' | 'dark'

function searchParam(name: string): string | undefined {
  return new URLSearchParams(window.location.search).get(name) || undefined
}

function accessToken(): string {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
  if (!token) throw new Error('Standalone access token is missing from the URL fragment.')
  return token
}

function initialSurface(): StandaloneSurface {
  const value = searchParam('surface')
  return value === 'popup' || value === 'expanded' ? value : 'sidepanel'
}

function initialTheme(): StandaloneTheme {
  return searchParam('theme') === 'dark' ? 'dark' : 'light'
}

export function StandaloneApp() {
  const [surface, setSurface] = useState<StandaloneSurface>(initialSurface)
  const [theme, setTheme] = useState<StandaloneTheme>(initialTheme)
  const [workId, setWorkId] = useState(searchParam('workId'))
  const [pageUrl, setPageUrl] = useState(searchParam('page') ?? 'https://chatgpt.com/')
  const themeMediaRules = useMemo(() => Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules).filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-color-scheme: dark'))
    } catch {
      return []
    }
  }), [])

  const runtime = useMemo(() => {
    const transport = new HttpNativeTransport('', accessToken())
    const service = new StandaloneAgentHelmService(new NativeAgentHelmService(transport))
    const browser = new StandaloneBrowserCapabilities({
      initialPageUrl: pageUrl,
      onOpenSidePanel: () => setSurface('sidepanel'),
      onOpenExpandedDetail: (nextWorkId) => {
        setWorkId(nextWorkId)
        setSurface('expanded')
      },
    })
    return { client: new BrowserControlPlaneClient(service, browser), browser }
    // Standalone runtime must stay stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    for (const rule of themeMediaRules) rule.media.mediaText = theme === 'dark' ? 'all' : 'not all'
    const url = new URL(window.location.href)
    url.searchParams.set('theme', theme)
    window.history.replaceState(null, '', url)
  }, [theme, themeMediaRules])

  const applyPageUrl = () => {
    runtime.browser.setPageUrl(pageUrl)
    const url = new URL(window.location.href)
    url.searchParams.set('page', pageUrl)
    window.history.replaceState(null, '', url)
  }

  const setLocale = (locale: HelmLocale) => {
    const url = new URL(window.location.href)
    url.searchParams.set('locale', locale)
    url.searchParams.set('surface', surface)
    url.searchParams.set('theme', theme)
    if (workId) url.searchParams.set('workId', workId)
    url.searchParams.set('page', pageUrl)
    window.location.assign(url)
  }

  return (
    <main className="preview-page">
      <div className="preview-toolbar standalone-toolbar">
        <strong>Agent Helm Chrome standalone</strong>
        {(['sidepanel', 'popup', 'expanded'] as const).map((value) => (
          <button key={value} type="button" data-active={surface === value} onClick={() => setSurface(value)}>{value}</button>
        ))}
        <label>Language
          <select value={helmLocale} onChange={(event) => setLocale(event.target.value as HelmLocale)} aria-label="Language">
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>Theme
          <select value={theme} onChange={(event) => setTheme(event.target.value as StandaloneTheme)} aria-label="Theme">
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label className="standalone-page-context">Page context
          <input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} onBlur={applyPageUrl} onKeyDown={(event) => { if (event.key === 'Enter') applyPageUrl() }} aria-label="Page context URL" />
        </label>
        <button type="button" onClick={applyPageUrl}>Apply page</button>
      </div>
      <div className="preview-stage">
        {surface === 'sidepanel' ? <div className="preview-sidepanel"><SidePanelApp client={runtime.client} /></div> : null}
        {surface === 'popup' ? <div className="preview-popup"><PopupApp client={runtime.client} /></div> : null}
        {surface === 'expanded' && workId ? <div className="preview-expanded"><ExpandedDetailApp client={runtime.client} workId={workId} /></div> : null}
        {surface === 'expanded' && !workId ? <div className="standalone-empty">Open a Work Detail from Side Panel first.</div> : null}
      </div>
    </main>
  )
}
