import type { ReactNode } from 'react'
import { SettingsButton, SettingsCard } from '../components/settings'
import type { TranslateFn } from '../i18n'
import type { SettingsActionHandler } from '../settings-runtime/settingsBindings'
import type { GroupSetting } from '../settings-runtime/settingsTypes'
import type { PrefsTabId } from './types'
import { renderAppearanceAfterSection } from './appearance/renderAppearanceSections'
import { EditorPerformanceCallout } from './editor/EditorPerformanceCallout'
import { WorkspaceNotesSettings } from './workspace/WorkspaceNotesSettings'

type ThemeCatalogEntry = { name: string }
type SectionRenderer = (args: Args, group: GroupSetting) => ReactNode

type Args = {
  t: TranslateFn
  activeTab: PrefsTabId
  workspaceRoot: string
  searchQuery: string
  pendingRestart: 'language' | null
  activeCssTheme: string | null
  availableStylesheets: readonly ThemeCatalogEntry[]
  activeSnippetNames: ReadonlySet<string>
  availableSnippets: readonly ThemeCatalogEntry[]
  activeExportStyleNames: ReadonlySet<string>
  availableExportStyles: readonly ThemeCatalogEntry[]
  onSettingAction: SettingsActionHandler
  onRestartNow: () => void
  onLater: () => void
}

export function createPreferencesSectionDecorators({
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
}: Args): {
  renderBeforeSection: (group: GroupSetting) => ReactNode
  renderAfterSection: (group: GroupSetting) => ReactNode
} {
  const commonArgs = {
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
  }

  const beforeSectionRenderers: Partial<Record<PrefsTabId, Partial<Record<string, SectionRenderer>>>> = {
    templates: {
      'templates.workspace': () => (
        <WorkspaceNotesSettings t={t} rootDir={workspaceRoot} highlightQuery={searchQuery} />
      ),
    },
  }

  const afterSectionRenderersById: Partial<Record<string, SectionRenderer>> = {
    'language.general': () =>
      pendingRestart === 'language' ? (
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
      ) : null,
    'editor.autosave': () => (activeTab === 'editor' ? <EditorPerformanceCallout t={t} /> : null),
  }

  const afterSectionRenderersBySection: Partial<Record<GroupSetting['section'], SectionRenderer>> = {
    appearance: (_, group) =>
      renderAppearanceAfterSection({
        t,
        group,
        activeSnippetNames,
        availableSnippets,
        activeExportStyleNames,
        availableExportStyles,
        onSettingAction,
      }),
    export: (_, group) =>
      renderAppearanceAfterSection({
        t,
        group,
        activeSnippetNames,
        availableSnippets,
        activeExportStyleNames,
        availableExportStyles,
        onSettingAction,
      }),
  }

  const renderBeforeSection = (group: GroupSetting): ReactNode => {
    return beforeSectionRenderers[activeTab]?.[group.id]?.(commonArgs, group) ?? null
  }

  const renderAfterSection = (group: GroupSetting): ReactNode => {
    const renderById = afterSectionRenderersById[group.id]
    if (renderById) return renderById(commonArgs, group)
    const renderBySection = afterSectionRenderersBySection[group.section]
    return renderBySection ? renderBySection(commonArgs, group) : null
  }

  return { renderBeforeSection, renderAfterSection }
}
