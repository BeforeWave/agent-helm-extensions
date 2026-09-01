import { useMemo, useState } from 'react'
import { ExpandedDetailApp } from '../src/app/ExpandedDetailApp'
import { PopupApp } from '../src/app/PopupApp'
import { SidePanelApp } from '../src/app/SidePanelApp'
import { createMockControlPlaneClient } from '../src/client/factories'
import type { ConnectionState } from '../src/models/controlPlane'

export function PreviewApp() {
  const runtime = useMemo(() => createMockControlPlaneClient(), [])
  const [surface, setSurface] = useState<'sidepanel' | 'popup' | 'expanded'>('sidepanel')
  const [revision, setRevision] = useState(0)

  const setConnection = (state: ConnectionState) => {
    runtime.service.setConnectionState(state)
    setRevision((value) => value + 1)
  }

  const setPage = (value: string) => {
    runtime.browser.setPageUrl(value)
    setRevision((current) => current + 1)
  }

  return (
    <main className="preview-page">
      <div className="preview-toolbar">
        <strong>Agent Helm preview</strong>
        {(['sidepanel', 'popup', 'expanded'] as const).map((value) => (
          <button key={value} type="button" data-active={surface === value} onClick={() => setSurface(value)}>{value}</button>
        ))}
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
