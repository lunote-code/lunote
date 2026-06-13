import { useEffect, useState } from 'react'
import type { TranslateFn } from '../i18n'
import type { UiLocaleId } from '../i18n/localeRegistry'
import {
  resolveSettingOptions,
  type SettingsActionHandler,
} from '../settings-runtime/settingsBindings'
import { SettingsRenderer } from '../settings-runtime/settingsRenderer'
import type { LeafSetting, SettingsSectionId } from '../settings-runtime/settingsTypes'
import { PREFS_TAB_DESCRIPTION_KEY, PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { createPreferencesSectionDecorators } from './preferencesSectionDecorators'
import { PreferencesSectionTabs } from './PreferencesSectionTabs'
import {
  groupIdForPrefsSectionTab,
  readStoredPrefsSectionTab,
  writeStoredPrefsSectionTab,
  type PrefsSectionTabId,
  type PrefsSectionTabsDefinition,
} from './prefsSectionTabsMeta'
import type { PrefsTabId } from './types'

type ThemeCatalogEntry = { name: string }

type Props = {
  prefsTab: PrefsTabId
  section: SettingsSectionId
  tabsDefinition: PrefsSectionTabsDefinition
  t: TranslateFn
  effectiveLocale: UiLocaleId
  workspaceRoot?: string
  searchQuery?: string
  pendingRestart: 'language' | null
  activeCssTheme: string | null
  availableStylesheets: readonly ThemeCatalogEntry[]
  activeSnippetNames: ReadonlySet<string>
  availableSnippets: readonly ThemeCatalogEntry[]
  activeExportStyleNames: ReadonlySet<string>
  availableExportStyles: readonly ThemeCatalogEntry[]
  onSettingAction: SettingsActionHandler
  onSettingFile?: (actionId: string, path: string, file: File) => void | Promise<void>
  onRestartNow: () => void
  onLater: () => void
}

export function TabbedSchemaPreferencesPanel({
  prefsTab,
  section,
  tabsDefinition,
  t,
  effectiveLocale,
  workspaceRoot = '',
  searchQuery = '',
  pendingRestart,
  activeCssTheme,
  availableStylesheets,
  activeSnippetNames,
  availableSnippets,
  activeExportStyleNames,
  availableExportStyles,
  onSettingAction,
  onSettingFile,
  onRestartNow,
  onLater,
}: Props) {
  const [activeSectionTab, setActiveSectionTab] = useState<PrefsSectionTabId>(() =>
    readStoredPrefsSectionTab(tabsDefinition),
  )
  const isSearching = searchQuery.trim().length > 0

  useEffect(() => {
    writeStoredPrefsSectionTab(tabsDefinition, activeSectionTab)
  }, [activeSectionTab, tabsDefinition])

  const { renderBeforeSection, renderAfterSection } = createPreferencesSectionDecorators({
    t,
    activeTab: prefsTab,
    workspaceRoot,
    searchQuery,
    pendingRestart,
    activeCssTheme,
    availableStylesheets,
    activeSnippetNames,
    availableSnippets,
    activeExportStyleNames,
    availableExportStyles,
    onSettingAction,
    onRestartNow,
    onLater,
  })

  const resolveOptions = (item: LeafSetting) => resolveSettingOptions(item, t, effectiveLocale)
  const panelTitle = t(PREFS_TAB_TITLE_KEY[prefsTab])
  const panelDescription = t(PREFS_TAB_DESCRIPTION_KEY[prefsTab])
  const activeGroupId = groupIdForPrefsSectionTab(tabsDefinition, activeSectionTab)

  return (
    <SettingsRenderer
      section={section}
      title={panelTitle}
      description={panelDescription}
      highlightQuery={searchQuery}
      resolveOptions={resolveOptions}
      renderBeforeSection={renderBeforeSection}
      renderAfterSection={renderAfterSection}
      onAction={onSettingAction}
      onFile={onSettingFile}
      visibleGroupIds={isSearching || !activeGroupId ? undefined : [activeGroupId]}
      hideGroupHeaders={!isSearching}
      toolbar={
        isSearching ? null : (
          <PreferencesSectionTabs
            t={t}
            definition={tabsDefinition}
            activeTab={activeSectionTab}
            onTabChange={setActiveSectionTab}
          />
        )
      }
      panelId={isSearching ? undefined : `prefs-${prefsTab}-panel-${activeSectionTab}`}
      className={`settings-page--prefs-${prefsTab}`}
    />
  )
}
