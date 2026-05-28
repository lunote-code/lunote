import type { ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import type { SettingsActionHandler } from '../../settings-runtime/settingsBindings'
import type { GroupSetting } from '../../settings-runtime/settingsTypes'
import { ObsidianCssFolderBlock } from './obsidianCssFolderBlock'
import { ThemeExtensionBlock } from './ThemeExtensionBlock'

type ThemeCatalogEntry = { name: string }

type Args = {
  t: TranslateFn
  group: GroupSetting
  activeCssTheme: string | null
  activeSnippetNames: ReadonlySet<string>
  availableSnippets: readonly ThemeCatalogEntry[]
  activeExportStyleNames: ReadonlySet<string>
  availableExportStyles: readonly ThemeCatalogEntry[]
  onSettingAction: SettingsActionHandler
}

export function renderAppearanceAfterSection({
  t,
  group,
  activeCssTheme,
  activeSnippetNames,
  availableSnippets,
  activeExportStyleNames,
  availableExportStyles,
  onSettingAction,
}: Args): ReactNode {
  if (group.id === 'appearance.obsidianCss') {
    return (
      <ObsidianCssFolderBlock
        t={t}
        activeCssTheme={activeCssTheme}
        onOpenFolder={() => void onSettingAction('theme.openThemeFolder', 'theme.cssFile')}
        onRescan={() => void onSettingAction('theme.refreshCssThemes', 'theme.cssFile')}
      />
    )
  }

  if (group.id === 'appearance.snippets') {
    return (
      <ThemeExtensionBlock
        t={t}
        scope="ui"
        titleKey="settings.theme.cssSnippets.manageTitle"
        descriptionKey="settings.theme.cssSnippets.manageDescription"
        statusActiveKey="settings.theme.cssSnippets.activeMessage"
        statusInactiveKey="settings.theme.cssSnippets.inactiveMessage"
        activeCount={activeSnippetNames.size}
        entries={availableSnippets}
        activeNames={activeSnippetNames}
        emptyCatalogKey="settings.theme.cssSnippets.emptyCatalog"
        openFolderLabelKey="settings.theme.cssSnippets.openFolder"
        rescanLabelKey="settings.theme.cssSnippets.rescan"
        enableLabelKey="settings.theme.fileList.enable"
        disableLabelKey="settings.theme.fileList.disable"
        onOpenFolder={() => void onSettingAction('theme.openThemeSnippetsFolder', 'theme.cssSnippets')}
        onRescan={() => void onSettingAction('theme.refreshCssSnippets', 'theme.cssSnippets')}
        onToggle={(name) => void onSettingAction('theme.toggleCssSnippet', name)}
      />
    )
  }

  if (group.id === 'export.styles') {
    return (
      <ThemeExtensionBlock
        t={t}
        scope="export"
        titleKey="settings.theme.exportCss.manageTitle"
        descriptionKey="settings.theme.exportCss.manageDescription"
        statusActiveKey="settings.theme.exportCss.activeMessage"
        statusInactiveKey="settings.theme.exportCss.inactiveMessage"
        activeCount={activeExportStyleNames.size}
        entries={availableExportStyles}
        activeNames={activeExportStyleNames}
        emptyCatalogKey="settings.theme.exportCss.emptyCatalog"
        openFolderLabelKey="settings.theme.exportCss.openFolder"
        rescanLabelKey="settings.theme.exportCss.rescan"
        enableLabelKey="settings.theme.fileList.enable"
        disableLabelKey="settings.theme.fileList.disable"
        onOpenFolder={() => void onSettingAction('theme.openThemeExportFolder', 'theme.exportCssSnippets')}
        onRescan={() => void onSettingAction('theme.refreshExportStyles', 'theme.exportCssSnippets')}
        onToggle={(name) => void onSettingAction('theme.toggleExportStyle', name)}
      />
    )
  }

  return null
}
