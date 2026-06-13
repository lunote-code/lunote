import { useEffect, useState } from 'react'

import type { TranslateFn } from '../i18n'
import type { UiLocaleId } from '../i18n/localeRegistry'
import { SettingsPage } from '../components/settings'
import { PreferencesNotice } from './PreferencesNotice'
import {
  formatPluginCatalogSourceLabel,
  isPluginCatalogConfigured,
} from '../plugins/pluginConstants'
import { PREFS_TAB_DESCRIPTION_KEY, PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { PreferencesSectionTabs } from './PreferencesSectionTabs'
import {
  PLUGINS_SECTION_TABS,
  readStoredPrefsSectionTab,
  writeStoredPrefsSectionTab,
  type PrefsSectionTabId,
} from './prefsSectionTabsMeta'
import { PluginCatalogList, type PluginListTab } from './plugins/PluginCatalogList'

type Props = {
  t: TranslateFn
  effectiveLocale: UiLocaleId
  searchQuery?: string
}

export function PluginsPreferencesPanel({ t, effectiveLocale, searchQuery = '' }: Props) {
  const catalogConfigured = isPluginCatalogConfigured()
  const isSearching = searchQuery.trim().length > 0
  const [activeTab, setActiveTab] = useState<PrefsSectionTabId>(() =>
    readStoredPrefsSectionTab(PLUGINS_SECTION_TABS),
  )
  const [updatesAvailableCount, setUpdatesAvailableCount] = useState(0)

  useEffect(() => {
    if (!isSearching) {
      writeStoredPrefsSectionTab(PLUGINS_SECTION_TABS, activeTab)
    }
  }, [activeTab, isSearching])

  return (
    <SettingsPage
      title={t(PREFS_TAB_TITLE_KEY.plugins)}
      description={t(PREFS_TAB_DESCRIPTION_KEY.plugins)}
      toolbar={
        catalogConfigured && !isSearching ? (
          <PreferencesSectionTabs
            t={t}
            definition={PLUGINS_SECTION_TABS}
            activeTab={activeTab}
            className="prefs-plugin-tabs"
            tabSuffixes={
              updatesAvailableCount > 0
                ? {
                    installed: <span className="prefs-plugin-tab-badge">{updatesAvailableCount}</span>,
                  }
                : undefined
            }
            onTabChange={(tabId) => setActiveTab(tabId)}
          />
        ) : null
      }
      className="settings-page--prefs settings-page--prefs-plugins"
    >
      {catalogConfigured ? (
        <p className="prefs-plugin-source">
          {t('settings.plugins.catalogSource', {
            url: formatPluginCatalogSourceLabel(window.location.origin),
          })}
        </p>
      ) : (
        <PreferencesNotice tone="muted" role="status">
          {t('settings.plugins.catalogNotConfigured')}
        </PreferencesNotice>
      )}
      {catalogConfigured ? (
        <PluginCatalogList
          t={t}
          effectiveLocale={effectiveLocale}
          searchQuery={searchQuery}
          activeTab={activeTab as PluginListTab}
          onUpdatesAvailableCountChange={setUpdatesAvailableCount}
        />
      ) : null}
    </SettingsPage>
  )
}
