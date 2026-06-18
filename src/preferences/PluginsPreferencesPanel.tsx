import type { TranslateFn } from '../i18n'
import type { UiLocaleId } from '../i18n/localeRegistry'
import {
  SettingsHelpPopover,
  SettingsInlineHelp,
  SettingsPage,
} from '../components/settings'
import { PreferencesNotice } from './PreferencesNotice'
import {
  formatPluginCatalogSourceLabel,
  isPluginCatalogConfigured,
} from '../plugins/pluginConstants'
import { PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { PluginCatalogList } from './plugins/PluginCatalogList'

type Props = {
  t: TranslateFn
  effectiveLocale: UiLocaleId
  searchQuery?: string
}

export function PluginsPreferencesPanel({ t, effectiveLocale, searchQuery = '' }: Props) {
  const catalogConfigured = isPluginCatalogConfigured()
  const pageTitle = t(PREFS_TAB_TITLE_KEY.plugins)
  const catalogSourceUrl = formatPluginCatalogSourceLabel(window.location.origin)

  return (
    <SettingsPage
      title={
        catalogConfigured ? (
          <SettingsInlineHelp
            label={pageTitle}
            help={
              <SettingsHelpPopover
                title={t('settings.plugins.catalogSourceToggle')}
                body={t('settings.plugins.catalogSource', { url: catalogSourceUrl })}
                bodyMono
                ariaLabel={t('settings.plugins.catalogSourceToggle')}
              />
            }
          />
        ) : (
          pageTitle
        )
      }
      className="settings-page--prefs settings-page--prefs-plugins"
    >
      {catalogConfigured ? (
        <PluginCatalogList t={t} effectiveLocale={effectiveLocale} searchQuery={searchQuery} />
      ) : (
        <PreferencesNotice tone="muted" role="status">
          {t('settings.plugins.catalogNotConfigured')}
        </PreferencesNotice>
      )}
    </SettingsPage>
  )
}
