import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import type { LocalizedString } from '../../plugins/pluginTypes'
import { resolvePluginCategoryLabel } from './pluginCatalogUiHelpers'

type Props = {
  t: TranslateFn
  effectiveLocale: UiLocaleId
  categories: Record<string, LocalizedString>
  activeCategoryId: string | null
  onCategoryChange: (categoryId: string | null) => void
}

export function PluginCategoryFilter({
  t,
  effectiveLocale,
  categories,
  activeCategoryId,
  onCategoryChange,
}: Props) {
  const entries = Object.entries(categories)
  if (entries.length === 0) return null

  return (
    <div className="prefs-plugin-category-filter" role="group" aria-label={t('settings.plugins.categoryFilterLabel')}>
      <button
        type="button"
        className={`prefs-plugin-category-chip${activeCategoryId === null ? ' is-active' : ''}`}
        aria-pressed={activeCategoryId === null}
        onClick={() => onCategoryChange(null)}
      >
        {t('settings.plugins.categoryAll')}
      </button>
      {entries.map(([categoryId, label]) => {
        const categoryLabel = resolvePluginCategoryLabel(categoryId, { [categoryId]: label }, effectiveLocale, t)
        const isActive = activeCategoryId === categoryId
        return (
          <button
            key={categoryId}
            type="button"
            className={`prefs-plugin-category-chip${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onCategoryChange(categoryId)}
          >
            {categoryLabel}
          </button>
        )
      })}
    </div>
  )
}
