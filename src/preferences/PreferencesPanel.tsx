import { useSyncExternalStore, type ReactNode } from 'react'
import type { TranslateFn } from '../i18n'
import type { UiLocaleId } from '../i18n/localeRegistry'
import { SettingsButton, SettingsCard } from '../components/settings'
import {
  resolveSettingOptions,
  type SettingsActionHandler,
} from '../settings-runtime/settingsBindings'
import { SettingsRenderer } from '../settings-runtime/settingsRenderer'
import type { GroupSetting, LeafSetting } from '../settings-runtime/settingsTypes'
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
import { renderAppearanceAfterSection } from './appearance/renderAppearanceSections'

const PANEL_HEADING: Record<PrefsTabId, string> = {
  general: 'settings.sidebar.general',
  appearance: 'settings.sidebar.appearance',
  export: 'settings.sidebar.export',
  editor: 'settings.sidebar.editor',
  language: 'settings.sidebar.language',
  shortcuts: 'settings.sidebar.shortcuts',
}

type Props = {
  t: TranslateFn
  activeTab: PrefsTabId
  effectiveLocale: UiLocaleId
  pendingRestart: 'language' | null
  onSettingAction: SettingsActionHandler
  onSettingFile?: (actionId: string, path: string, file: File) => void | Promise<void>
  onRestartNow: () => void
  onLater: () => void
}

export function PreferencesPanel({
  t,
  activeTab,
  effectiveLocale,
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
  const activeSnippetNames = new Set(getActiveThemeSnippetNames())
  const availableSnippets = listAvailableThemeSnippets()
  const activeExportStyleNames = new Set(getActiveThemeExportStyleNames())
  const availableExportStyles = listAvailableThemeExportStyles()

  const renderBeforeSection = (group: GroupSetting): ReactNode => {
    if (group.id !== 'language.general' || pendingRestart !== 'language') return null
    return (
      <SettingsCard tone="accent" role="status">
        <p className="prefs-restart-text">{t('prefs.language.restartRequired')}</p>
        <div className="settings-inline-controls">
          <SettingsButton type="button" variant="primary" onClick={() => void onRestartNow()}>
            {t('prefs.restart.now')}
          </SettingsButton>
          <SettingsButton type="button" variant="secondary" onClick={onLater}>
            {t('prefs.restart.later')}
          </SettingsButton>
        </div>
      </SettingsCard>
    )
  }

  const renderAfterSection = (group: GroupSetting): ReactNode => {
    if (group.section === 'appearance' || group.section === 'export') {
      return renderAppearanceAfterSection({
        t,
        group,
        activeCssTheme,
        activeSnippetNames,
        availableSnippets,
        activeExportStyleNames,
        availableExportStyles,
        onSettingAction,
      })
    }
    return null
  }

  const resolveOptions = (item: LeafSetting) => resolveSettingOptions(item, t, effectiveLocale)

  if (activeTab === 'shortcuts') {
    return (
      <div
        className="prefs-content"
        role="tabpanel"
        id={`prefs-panel-${activeTab}`}
        aria-labelledby={`prefs-tab-${activeTab}`}
      >
        <div key={activeTab} className="prefs-content-body prefs-panel-animate">
          <ShortcutsPreferencesPanel t={t} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="prefs-content"
      role="tabpanel"
      id={`prefs-panel-${activeTab}`}
      aria-labelledby={`prefs-tab-${activeTab}`}
    >
      <div key={activeTab} className="prefs-content-body prefs-panel-animate">
        <SettingsRenderer
          section={activeTab}
          title={t(PANEL_HEADING[activeTab])}
          resolveOptions={resolveOptions}
          renderBeforeSection={renderBeforeSection}
          renderAfterSection={renderAfterSection}
          onAction={onSettingAction}
          onFile={onSettingFile}
        />
      </div>
    </div>
  )
}
