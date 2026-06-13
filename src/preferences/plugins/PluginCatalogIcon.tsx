import type { PluginCatalogDetail, PluginCatalogIndexEntry } from '../../plugins/pluginTypes'
import { resolvePluginIconDisplay } from './pluginCatalogUiHelpers'

type Props = {
  row: PluginCatalogIndexEntry
  detail?: PluginCatalogDetail | null
  iconBroken?: boolean
  className?: string
  onIconError?: () => void
}

export function PluginCatalogIcon({
  row,
  detail = null,
  iconBroken = false,
  className = 'prefs-plugin-card-icon',
  onIconError,
}: Props) {
  const display = resolvePluginIconDisplay(row, { iconBroken, detail })

  if (display.kind === 'image') {
    return (
      <img
        className={className}
        src={display.src}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        onError={onIconError}
      />
    )
  }

  return (
    <div className={`${className} prefs-plugin-card-icon--fallback`} aria-hidden="true">
      {display.label}
    </div>
  )
}
