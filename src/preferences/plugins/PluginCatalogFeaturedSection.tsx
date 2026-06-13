import type { ComponentProps } from 'react'

import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import type { LocalizedString } from '../../plugins/pluginTypes'
import { PluginCatalogCard } from './PluginCatalogCard'

type CardProps = ComponentProps<typeof PluginCatalogCard>

type Props = {
  t: TranslateFn
  rows: CardProps['row'][]
  effectiveLocale: UiLocaleId
  categories: Record<string, LocalizedString>
  cardPropsForRow: (row: CardProps['row']) => Omit<CardProps, 'row' | 'effectiveLocale' | 'categories' | 't'>
}

export function PluginCatalogFeaturedSection({ t, rows, effectiveLocale, categories, cardPropsForRow }: Props) {
  if (rows.length === 0) return null

  return (
    <section className="prefs-plugin-featured" aria-labelledby="prefs-plugin-featured-title">
      <div className="prefs-plugin-featured-header">
        <h4 id="prefs-plugin-featured-title" className="prefs-plugin-section-title">
          {t('settings.plugins.featuredSection')}
        </h4>
      </div>
      <div className="prefs-plugin-featured-grid">
        {rows.map((row) => (
          <PluginCatalogCard
            key={`featured-${row.id}`}
            row={row}
            effectiveLocale={effectiveLocale}
            categories={categories}
            t={t}
            {...cardPropsForRow(row)}
          />
        ))}
      </div>
    </section>
  )
}
