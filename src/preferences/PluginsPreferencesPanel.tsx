import type { TranslateFn } from '../i18n'
import { PreferencesNotice } from './PreferencesNotice'
import {
  formatPluginCatalogSourceLabel,
  isPluginCatalogConfigured,
  PLUGIN_CATALOG_SETUP_DOC_URL,
} from '../plugins/pluginConstants'
import { PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { PluginCatalogList } from './plugins/PluginCatalogList'
import {
  SettingsHelpPopover,
  SettingsInlineHelp,
  SettingsPage,
} from '../components/settings'

type Props = {
  t: TranslateFn
  effectiveLocale: import('../i18n/localeRegistry').UiLocaleId
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
        <div data-testid="prefs-plugins-catalog-unavailable" className="prefs-plugins-setup-guide">
          <PreferencesNotice tone="muted" role="status">
            {t('settings.plugins.catalogNotConfigured')}
          </PreferencesNotice>
          <div className="prefs-plugins-setup-body">
            <p className="prefs-plugins-setup-lead">{t('settings.plugins.catalogSetupLead')}</p>
            <ol className="prefs-plugins-setup-steps">
              <li>{t('settings.plugins.catalogSetupStepConfig')}</li>
              <li>{t('settings.plugins.catalogSetupStepDev')}</li>
              <li>{t('settings.plugins.catalogSetupStepRestart')}</li>
            </ol>
            <a
              className="prefs-plugins-setup-doc-link"
              href={PLUGIN_CATALOG_SETUP_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('settings.plugins.catalogSetupDocLink')}
            </a>
          </div>
        </div>
      )}
    </SettingsPage>
  )
}
