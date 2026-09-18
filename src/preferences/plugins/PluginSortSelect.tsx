import { useMemo } from 'react'
import type { TranslateFn } from '../../i18n'
import { SettingsSelect, type SettingsSelectOption } from '../../components/settings'
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
  const options = useMemo<SettingsSelectOption<PluginSortMode>[]>(
    () =>
      SORT_MODES.map((mode) => ({
        value: mode,
        label: t(SORT_LABEL_KEYS[mode]),
      })),
    [t],
  )

  const selector = (
    <SettingsSelect
      value={value}
      options={options}
      ariaLabel={t('settings.plugins.sortLabel')}
      onValueChange={onChange}
    />
  )

  if (compact) {
    return <div className="prefs-plugin-sort prefs-plugin-sort--compact">{selector}</div>
  }

  return (
    <label className="prefs-plugin-sort">
      <span className="prefs-plugin-sort-label">{t('settings.plugins.sortLabel')}</span>
      {selector}
    </label>
  )
}
