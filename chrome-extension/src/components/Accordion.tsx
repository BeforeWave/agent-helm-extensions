import { Children, isValidElement, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronIcon } from './Icons'

interface AccordionProps {
  title: string
  summary?: ReactNode
  expanded: boolean
  disabled?: boolean
  onToggle: () => void
  onTitleClick?: () => void
  children: ReactNode
}

export function Accordion({ title, summary, expanded, disabled = false, onToggle, onTitleClick, children }: AccordionProps): React.JSX.Element {
  const childArray = Children.toArray(children)
  const firstChild = childArray[0]
  const embeddedSummary = isValidElement<{ 'data-accordion-summary'?: boolean }>(firstChild)
    && firstChild.props['data-accordion-summary']
    ? firstChild
    : null
  const headerSummary = summary ?? embeddedSummary
  const bodyChildren = embeddedSummary ? childArray.slice(1) : childArray
  const effectiveExpanded = !disabled && expanded
  const body = effectiveExpanded ? <div className="accordion__body">{bodyChildren}</div> : null

  if (onTitleClick) {
    const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      onToggle()
    }

    return (
      <section className="accordion">
        <div
          className="accordion__trigger accordion__trigger--split"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={effectiveExpanded}
          aria-disabled={disabled || undefined}
          onClick={() => { if (!disabled) onToggle() }}
          onKeyDown={onRowKeyDown}
        >
          <span className="accordion__label">
            <button
              type="button"
              className="accordion__title-button"
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onTitleClick()
              }}
            >
              {title}
            </button>
            {headerSummary}
          </span>
          <span className="accordion__arrow" aria-hidden="true">
            <ChevronIcon direction={effectiveExpanded ? 'up' : 'down'} />
          </span>
        </div>
        {body}
      </section>
    )
  }

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
      {body}
    </section>
  )
}
