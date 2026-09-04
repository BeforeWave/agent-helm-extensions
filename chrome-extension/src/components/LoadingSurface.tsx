import type { ReactNode } from "react"

export function LoadingSurface({
  loading,
  label,
  children,
}: {
  loading: boolean
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="loading-surface" data-loading={loading || undefined} aria-busy={loading}>
      <div className="loading-surface__content">{children}</div>
      {loading ? (
        <div className="loading-surface__overlay" role="status" aria-live="polite">
          <span>{label}</span>
        </div>
      ) : null}
    </div>
  )
}
