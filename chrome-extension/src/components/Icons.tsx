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
