import { useEffect, useState } from 'react'
import type { TranslateFn } from '../i18n'
import { SettingsPage } from '../components/settings'
import { PREFS_TAB_DESCRIPTION_KEY, PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { PreferencesSectionTabs } from './PreferencesSectionTabs'
import {
  readStoredPrefsSectionTab,
  TEMPLATES_SECTION_TABS,
  writeStoredPrefsSectionTab,
  type PrefsSectionTabId,
} from './prefsSectionTabsMeta'
import { WorkspaceNotesSettings, type WorkspaceNotesSection } from './workspace/WorkspaceNotesSettings'

type Props = {
  t: TranslateFn
  workspaceRoot?: string
  searchQuery?: string
}

export function TemplatesPreferencesPanel({ t, workspaceRoot = '', searchQuery = '' }: Props) {
  const [activeSectionTab, setActiveSectionTab] = useState<PrefsSectionTabId>(() =>
    readStoredPrefsSectionTab(TEMPLATES_SECTION_TABS),
  )
  const isSearching = searchQuery.trim().length > 0

  useEffect(() => {
    writeStoredPrefsSectionTab(TEMPLATES_SECTION_TABS, activeSectionTab)
  }, [activeSectionTab])

  const visibleSection: WorkspaceNotesSection = isSearching
    ? 'all'
    : activeSectionTab === 'newNote'
      ? 'templates'
      : 'daily'

  return (
    <SettingsPage
      title={t(PREFS_TAB_TITLE_KEY.templates)}
      description={t(PREFS_TAB_DESCRIPTION_KEY.templates)}
      toolbar={
        isSearching ? null : (
          <PreferencesSectionTabs
            t={t}
            definition={TEMPLATES_SECTION_TABS}
            activeTab={activeSectionTab}
            onTabChange={setActiveSectionTab}
          />
        )
      }
      className="settings-page--prefs settings-page--prefs-templates"
    >
      <WorkspaceNotesSettings
        t={t}
        rootDir={workspaceRoot}
        highlightQuery={searchQuery}
        visibleSection={visibleSection}
        hideSectionHeaders={!isSearching}
        panelId={isSearching ? undefined : `prefs-templates-panel-${activeSectionTab}`}
      />
    </SettingsPage>
  )
}
