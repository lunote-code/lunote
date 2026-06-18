import type { ReactNode } from 'react'

import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import type { LocalizedString } from '../../plugins/pluginTypes'
import { resolvePluginCategoryLabel } from './pluginCatalogUiHelpers'

export const PLUGIN_FILTER_INSTALLED = '__installed__'

type Props = {
  t: TranslateFn
  effectiveLocale: UiLocaleId
  categories: Record<string, LocalizedString>
  activeFilterId: string | null
  updatesAvailableCount?: number
  onFilterChange: (filterId: string | null) => void
}

function InstalledFilterBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="prefs-plugin-filter-badge">{count}</span>
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`prefs-plugin-category-chip${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function PluginCategoryFilter({
  t,
  effectiveLocale,
  categories,
  activeFilterId,
  updatesAvailableCount = 0,
  onFilterChange,
}: Props) {
  const entries = Object.entries(categories)

  return (
    <div className="prefs-plugin-category-filter" role="group" aria-label={t('settings.plugins.categoryFilterLabel')}>
      <FilterChip active={activeFilterId === null} onClick={() => onFilterChange(null)}>
        {t('settings.plugins.categoryAll')}
      </FilterChip>
      <FilterChip
        active={activeFilterId === PLUGIN_FILTER_INSTALLED}
        onClick={() => onFilterChange(PLUGIN_FILTER_INSTALLED)}
      >
        {t('settings.plugins.tabInstalled')}
        <InstalledFilterBadge count={updatesAvailableCount} />
      </FilterChip>
      {entries.map(([categoryId, label]) => {
        const categoryLabel = resolvePluginCategoryLabel(categoryId, { [categoryId]: label }, effectiveLocale, t)
        const isActive = activeFilterId === categoryId
        return (
          <FilterChip key={categoryId} active={isActive} onClick={() => onFilterChange(categoryId)}>
            {categoryLabel}
          </FilterChip>
        )
      })}
    </div>
  )
}
