import type { ReactNode } from 'react'
import { Icon, type SemanticIconName } from './icons'

export type EmptyStateVariant = 'compact' | 'page' | 'sidebar'

type Props = {
  icon: SemanticIconName
  title: string
  description?: string
  hint?: string
  actions?: ReactNode
  footer?: ReactNode
  variant?: EmptyStateVariant
  className?: string
}

function joinClasses(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function EmptyState({
  icon,
  title,
  description,
  hint,
  actions,
  footer,
  variant = 'compact',
  className,
}: Props) {
  return (
    <div
      className={joinClasses('luna-empty-state', `luna-empty-state--${variant}`, className)}
      role="status"
      aria-live="polite"
    >
      <Icon name={icon} size="display" tone="muted" />
      <h2 className="luna-empty-state-title">{title}</h2>
      {description ? <p className="luna-empty-state-desc">{description}</p> : null}
      {actions ? <div className="luna-empty-state-actions">{actions}</div> : null}
      {hint ? <p className="luna-empty-state-hint">{hint}</p> : null}
      {footer ? <div className="luna-empty-state-footer">{footer}</div> : null}
    </div>
  )
}
