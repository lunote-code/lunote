import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  className?: string
}

export function PluginVerifiedMark({ t, className }: Props) {
  const label = t('settings.plugins.verified')
  return (
    <span
      className={['prefs-plugin-verified-mark', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      title={label}
    >
      <Icon name="callout-success" size="sm" tone="accent" aria-hidden="true" />
    </span>
  )
}
