import type { TranslateFn } from '../../i18n'
import type { SettingsActionHandler } from '../../settings-runtime/settingsBindings'
import { ThemeStylesPanel } from './ThemeStylesPanel'

type Entry = { name: string }

type Props = {
  t: TranslateFn
  entries: readonly Entry[]
  activeNames: ReadonlySet<string>
  onSettingAction: SettingsActionHandler
}

export function ExportStylesList({ t, entries, activeNames, onSettingAction }: Props) {
  const activeCount = entries.filter((entry) => activeNames.has(entry.name)).length
  const status =
    activeCount > 0
      ? t('settings.theme.exportCss.activeMessage', { count: String(activeCount) })
      : t('settings.theme.exportCss.inactiveMessage')

  return (
    <ThemeStylesPanel
      t={t}
      status={status}
      listId="prefs-export-css-styles-list"
      listAriaLabel={t('settings.theme.exportCss.manageTitle')}
      entries={entries}
      activeNames={activeNames}
      enableLabelKey="settings.theme.exportCss.enable"
      disableLabelKey="settings.theme.exportCss.disable"
      emptyMessage={t('settings.theme.exportCss.emptyCatalog')}
      onToggle={(name) =>
        void onSettingAction('theme.setExportCssFile', activeNames.has(name) ? '' : name)
      }
    />
  )
}
