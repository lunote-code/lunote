import { useSyncExternalStore } from 'react'
import type { TranslateFn } from '../i18n'
import type { UiLocaleId } from '../i18n/localeRegistry'
import {
  resolveSettingOptions,
  type SettingsActionHandler,
} from '../settings-runtime/settingsBindings'
import { SettingsRenderer } from '../settings-runtime/settingsRenderer'
import type { LeafSetting } from '../settings-runtime/settingsTypes'
import { ShortcutsPreferencesPanel } from './ShortcutsPreferencesPanel'
import type { PrefsTabId } from './types'
import {
  getActiveThemeExportStyleNames,
  listAvailableThemeExportStyles,
  subscribeThemeExportStyleCatalog,
} from '../theme-runtime/themeExportStyleRuntime'
import {
  getActiveThemeStylesheetName,
  listAvailableThemeStylesheets,
  subscribeThemeStylesheetCatalog,
} from '../theme-runtime/themeStylesheetRuntime'
import { getActiveThemeSnippetNames, listAvailableThemeSnippets, subscribeThemeSnippetCatalog } from '../theme-runtime/themeSnippetRuntime'
import { PREFS_TAB_DESCRIPTION_KEY, PREFS_TAB_TITLE_KEY } from './prefsMeta'
import {
  APPEARANCE_SECTION_TABS,
  EDITOR_SECTION_TABS,
  EXPORT_SECTION_TABS,
} from './prefsSectionTabsMeta'
import { createPreferencesSectionDecorators } from './preferencesSectionDecorators'
import { PreferencesTabPanel } from './PreferencesTabPanel'
import { TabbedSchemaPreferencesPanel } from './TabbedSchemaPreferencesPanel'
import { PluginsPreferencesPanel } from './PluginsPreferencesPanel'
import { TemplatesPreferencesPanel } from './TemplatesPreferencesPanel'

type Props = {
  t: TranslateFn
  activeTab: PrefsTabId
  effectiveLocale: UiLocaleId
  workspaceRoot?: string
  searchQuery?: string
  pendingRestart: 'language' | null
  onSettingAction: SettingsActionHandler
  onSettingFile?: (actionId: string, path: string, file: File) => void | Promise<void>
  onRestartNow: () => void
  onLater: () => void
}

const TABBED_SCHEMA_TABS = new Set<PrefsTabId>(['appearance', 'export', 'editor'])

export function PreferencesPanel({
  t,
  activeTab,
  effectiveLocale,
  workspaceRoot = '',
  searchQuery = '',
  pendingRestart,
  onSettingAction,
  onSettingFile,
  onRestartNow,
  onLater,
}: Props) {
  useSyncExternalStore(
    subscribeThemeStylesheetCatalog,
    () => listAvailableThemeStylesheets().map((entry) => entry.name).join('|'),
    () => '',
  )
  useSyncExternalStore(
    subscribeThemeSnippetCatalog,
    () => listAvailableThemeSnippets().map((entry) => entry.name).join('|'),
    () => '',
  )
  useSyncExternalStore(
    subscribeThemeSnippetCatalog,
    () => getActiveThemeSnippetNames().join('|'),
    () => '',
  )
  useSyncExternalStore(
    subscribeThemeExportStyleCatalog,
    () => listAvailableThemeExportStyles().map((entry) => entry.name).join('|'),
    () => '',
  )
  useSyncExternalStore(
    subscribeThemeExportStyleCatalog,
    () => getActiveThemeExportStyleNames().join('|'),
    () => '',
  )

  const activeCssTheme = getActiveThemeStylesheetName()
  const availableStylesheets = listAvailableThemeStylesheets()
  const activeSnippetNames = new Set(getActiveThemeSnippetNames())
  const availableSnippets = listAvailableThemeSnippets()
  const activeExportStyleNames = new Set(getActiveThemeExportStyleNames())
  const availableExportStyles = listAvailableThemeExportStyles()

  const tabbedSchemaProps = {
    t,
    effectiveLocale,
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
    onSettingFile,
    onRestartNow,
    onLater,
  }

  if (activeTab === 'shortcuts') {
    return (
      <PreferencesTabPanel tabId={activeTab}>
        <ShortcutsPreferencesPanel t={t} highlightQuery={searchQuery} />
      </PreferencesTabPanel>
    )
  }

  if (activeTab === 'plugins') {
    return (
      <PreferencesTabPanel tabId={activeTab}>
        <PluginsPreferencesPanel t={t} effectiveLocale={effectiveLocale} searchQuery={searchQuery} />
      </PreferencesTabPanel>
    )
  }

  if (activeTab === 'templates') {
    return (
      <PreferencesTabPanel tabId={activeTab}>
        <TemplatesPreferencesPanel t={t} workspaceRoot={workspaceRoot} searchQuery={searchQuery} />
      </PreferencesTabPanel>
    )
  }

  if (TABBED_SCHEMA_TABS.has(activeTab)) {
    const tabsDefinition =
      activeTab === 'appearance'
        ? APPEARANCE_SECTION_TABS
        : activeTab === 'export'
          ? EXPORT_SECTION_TABS
          : EDITOR_SECTION_TABS

    return (
      <PreferencesTabPanel tabId={activeTab}>
        <TabbedSchemaPreferencesPanel
          prefsTab={activeTab}
          section={activeTab}
          tabsDefinition={tabsDefinition}
          {...tabbedSchemaProps}
        />
      </PreferencesTabPanel>
    )
  }

  const panelTitle = t(PREFS_TAB_TITLE_KEY[activeTab])
  const panelDescription = t(PREFS_TAB_DESCRIPTION_KEY[activeTab])
  const { renderBeforeSection, renderAfterSection } = createPreferencesSectionDecorators({
    t,
    activeTab,
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

  return (
    <PreferencesTabPanel tabId={activeTab}>
      <SettingsRenderer
        section={activeTab}
        title={panelTitle}
        description={panelDescription}
        highlightQuery={searchQuery}
        resolveOptions={resolveOptions}
        renderBeforeSection={renderBeforeSection}
        renderAfterSection={renderAfterSection}
        onAction={onSettingAction}
        onFile={onSettingFile}
        className={`settings-page--prefs-${activeTab}`}
      />
    </PreferencesTabPanel>
  )
}
