import { useEffect, useMemo, useState } from 'react'
import { ExpandedDetailApp } from '../src/app/ExpandedDetailApp'
import { PopupApp } from '../src/app/PopupApp'
import { SidePanelApp } from '../src/app/SidePanelApp'
import { createMockControlPlaneClient } from '../src/client/factories'
import { helmLocale, type HelmLocale } from '../src/locale'
import type { ConnectionState } from '../src/models/controlPlane'

type PreviewSurface = 'sidepanel' | 'popup' | 'expanded'
type PreviewTheme = 'light' | 'dark'

function initialSurface(): PreviewSurface {
  const value = new URLSearchParams(window.location.search).get('surface')
  return value === 'popup' || value === 'expanded' ? value : 'sidepanel'
}

function initialTheme(): PreviewTheme {
  return new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light'
}

export function PreviewApp() {
  const [surface, setSurface] = useState<PreviewSurface>(initialSurface)
  const [revision, setRevision] = useState(0)
  const [theme, setTheme] = useState<PreviewTheme>(initialTheme)
  const [localAgentConnected, setLocalAgentConnected] = useState(false)
  const themeMediaRules = useMemo(() => Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules).filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-color-scheme: dark'))
    } catch {
      return []
    }
  }), [])
  const runtime = useMemo(() => {
    const created = createMockControlPlaneClient({
      onOpenSidePanel: () => setSurface('sidepanel'),
      onOpenExpandedDetail: () => setSurface('expanded'),
    })
    created.service.setLocalAgentConnected(false)
    return created
  }, [])

  useEffect(() => {
    for (const rule of themeMediaRules) rule.media.mediaText = theme === 'dark' ? 'all' : 'not all'
    const url = new URL(window.location.href)
    url.searchParams.set('theme', theme)
    window.history.replaceState(null, '', url)
  }, [theme, themeMediaRules])

  const setConnection = (state: ConnectionState) => {
    runtime.service.setConnectionState(state)
    setRevision((value) => value + 1)
  }

  const setPage = (value: string) => {
    runtime.browser.setPageUrl(value)
    setRevision((current) => current + 1)
  }

  const setLocale = (locale: HelmLocale) => {
    const url = new URL(window.location.href)
    url.searchParams.set('locale', locale)
    url.searchParams.set('surface', surface)
    url.searchParams.set('theme', theme)
    window.location.assign(url)
  }

  const setAgentConnected = (connected: boolean) => {
    runtime.service.setLocalAgentConnected(connected)
    setLocalAgentConnected(connected)
    setRevision((current) => current + 1)
  }

  return (
    <main className="preview-page">
      <div className="preview-toolbar">
        <strong>Agent Helm preview</strong>
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
          <select value={theme} onChange={(event) => setTheme(event.target.value as PreviewTheme)} aria-label="Theme">
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label>Local Agent
          <select value={localAgentConnected ? 'connected' : 'disconnected'} onChange={(event) => setAgentConnected(event.target.value === 'connected')} aria-label="Local Agent">
            <option value="disconnected">disconnected</option>
            <option value="connected">DSH connected</option>
          </select>
        </label>
        <select defaultValue="connected" onChange={(event) => setConnection(event.target.value as ConnectionState)} aria-label="Connection state">
          <option value="connected">connected</option>
          <option value="unavailable">unavailable</option>
          <option value="install-required">install-required</option>
          <option value="error">error</option>
        </select>
        <select defaultValue="conversation" onChange={(event) => setPage(event.target.value === 'conversation' ? 'https://chatgpt.com/c/preview-conversation' : event.target.value === 'chatgpt' ? 'https://chatgpt.com/' : 'https://example.com/')} aria-label="Page context">
          <option value="conversation">ChatGPT conversation</option>
          <option value="chatgpt">ChatGPT ordinary page</option>
          <option value="other">Other page</option>
        </select>
      </div>
      <div className="preview-stage" key={`${revision}:${surface}`}>
        {surface === 'sidepanel' ? <div className="preview-sidepanel"><SidePanelApp client={runtime.client} /></div> : null}
        {surface === 'popup' ? <div className="preview-popup"><PopupApp client={runtime.client} /></div> : null}
        {surface === 'expanded' ? <div className="preview-expanded"><ExpandedDetailApp client={runtime.client} workId="work-browser-extension" /></div> : null}
      </div>
    </main>
  )
}
