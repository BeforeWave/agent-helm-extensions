interface ChevronIconProps {
  direction?: 'down' | 'up' | 'right'
  className?: string
}

export function ChevronIcon({ direction = 'down', className }: ChevronIconProps): React.JSX.Element {
  const points = direction === 'right'
    ? '7 5 12 10 7 15'
    : direction === 'up'
      ? '5 12 10 7 15 12'
      : '5 8 10 13 15 8'
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <polyline points={points} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function AgentIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3.25V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="2.5" r="1" fill="currentColor" />
      <rect x="4" y="5" width="12" height="9" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="9.25" r="1" fill="currentColor" />
      <circle cx="12.5" cy="9.25" r="1" fill="currentColor" />
      <path d="M7.5 12h5M6 16.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
