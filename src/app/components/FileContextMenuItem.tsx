import { Icon } from '../../design-system/icons/Icon'
import type { SemanticIconName } from '../../design-system/icons/iconRegistry'

export function FileContextMenuItem({
  icon,
  label,
  disabled,
  danger,
  onClick,
}: {
  icon: SemanticIconName
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={['file-ctx-item', danger ? 'file-ctx-item-danger' : ''].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="file-ctx-item-leading" aria-hidden>
        <Icon name={icon} size="sm" tone={danger ? 'default' : 'muted'} stroke="regular" />
      </span>
      <span className="file-ctx-item-label">{label}</span>
    </button>
  )
}
