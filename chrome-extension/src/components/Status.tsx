import { connectionStateLabel, t } from '../locale'
import type { ConnectionState, RuntimeState } from '../models/controlPlane'

export function StatusDot({ state }: { state: RuntimeState | ConnectionState }) {
  return <span className="status-dot" data-state={state} aria-hidden="true" />
}

import type { ExtensionConnectionPresentation } from '../models/controlPlane'

export function ConnectionStatus({ state, message }: { state: ConnectionState; message?: string }) {
  return (
    <div className="connection-status" data-state={state} title={message}>
      <span>{connectionStateLabel(state)}</span>
    </div>
  )
}

export function ExtensionConnectionStatus({ presentation }: { presentation: ExtensionConnectionPresentation }): React.JSX.Element {
  const connected = presentation.state === 'connected'
  return (
    <span
      className="extension-connection-icon"
      data-state={presentation.state}
      title={presentation.issue}
      aria-label={presentation.issue}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {connected ? (
          <>
            <path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1" />
            <path d="M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9" />
            <path d="M21 21v-2h-4" />
            <path d="M3 5h4V3" />
            <path d="M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3" />
          </>
        ) : (
          <>
            <path d="m19 5 3-3" />
            <path d="m2 22 3-3" />
            <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
            <path d="M7.5 13.5 10 11" />
            <path d="M10.5 16.5 13 14" />
            <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
          </>
        )}
      </svg>
    </span>
  )
}
