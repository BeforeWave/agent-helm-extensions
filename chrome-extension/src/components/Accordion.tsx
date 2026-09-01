import { Children, isValidElement, type ReactNode } from 'react'
import { ChevronIcon } from './Icons'

interface AccordionProps {
  title: string
  summary?: ReactNode
  expanded: boolean
  disabled?: boolean
  onToggle: () => void
  children: ReactNode
}

export function Accordion({ title, summary, expanded, disabled = false, onToggle, children }: AccordionProps): React.JSX.Element {
  const childArray = Children.toArray(children)
  const firstChild = childArray[0]
  const embeddedSummary = isValidElement<{ 'data-accordion-summary'?: boolean }>(firstChild)
    && firstChild.props['data-accordion-summary']
    ? firstChild
    : null
  const headerSummary = summary ?? embeddedSummary
  const bodyChildren = embeddedSummary ? childArray.slice(1) : childArray
  const effectiveExpanded = !disabled && expanded

  return (
    <section className="accordion">
      <button
        type="button"
        className="accordion__trigger"
        aria-expanded={effectiveExpanded}
        disabled={disabled}
        onClick={onToggle}
        style={disabled ? { cursor: 'default', background: 'inherit' } : undefined}
      >
        <span className="accordion__label">
          <span className="accordion__title">{title}</span>
          {headerSummary}
        </span>
        <span
          className="accordion__arrow"
          aria-hidden="true"
          style={disabled ? { color: 'var(--helm-secondary)', background: 'transparent' } : undefined}
        >
          <ChevronIcon direction={effectiveExpanded ? 'up' : 'down'} />
        </span>
      </button>
      {effectiveExpanded ? <div className="accordion__body">{bodyChildren}</div> : null}
    </section>
  )
}
