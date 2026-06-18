import type { TranslateFn } from '../../i18n'
import {
  readStoredPluginSortMode,
  writeStoredPluginSortMode,
  type PluginSortMode,
} from './pluginCatalogSort'

export function readInitialPluginSortMode(): PluginSortMode {
  return readStoredPluginSortMode()
}

export function persistPluginSortMode(mode: PluginSortMode): void {
  writeStoredPluginSortMode(mode)
}

const SORT_MODES: readonly PluginSortMode[] = ['featured', 'name', 'updated']

const SORT_LABEL_KEYS: Record<PluginSortMode, string> = {
  featured: 'settings.plugins.sortFeatured',
  name: 'settings.plugins.sortName',
  updated: 'settings.plugins.sortUpdated',
}

type Props = {
  t: TranslateFn
  value: PluginSortMode
  onChange: (mode: PluginSortMode) => void
  compact?: boolean
}

export function PluginSortSelect({ t, value, onChange, compact = false }: Props) {
  const select = (
    <select
      className="prefs-plugin-sort-select"
      value={value}
      aria-label={t('settings.plugins.sortLabel')}
      title={t('settings.plugins.sortLabel')}
      onChange={(event) => onChange(event.target.value as PluginSortMode)}
    >
      {SORT_MODES.map((mode) => (
        <option key={mode} value={mode}>
          {t(SORT_LABEL_KEYS[mode])}
        </option>
      ))}
    </select>
  )

  if (compact) {
    return <div className="prefs-plugin-sort prefs-plugin-sort--compact">{select}</div>
  }

  return (
    <label className="prefs-plugin-sort">
      <span className="prefs-plugin-sort-label">{t('settings.plugins.sortLabel')}</span>
      {select}
    </label>
  )
}
