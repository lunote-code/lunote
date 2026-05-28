import type { TranslateFn } from '../../i18n'
import { SettingsButton, SettingsCard } from '../../components/settings'

type Props = {
  t: TranslateFn
  activeCssTheme: string | null
  onOpenFolder: () => void
  onRescan: () => void
}

export function ObsidianCssFolderBlock({ t, activeCssTheme, onOpenFolder, onRescan }: Props) {
  return (
    <SettingsCard tone="default" className="prefs-theme-extension">
      <div className="prefs-theme-extension-header">
        <div className="prefs-theme-extension-heading">
          <h5 className="prefs-theme-extension-title">{t('settings.theme.cssFile.folderTitle')}</h5>
          <span className="prefs-theme-scope-badge prefs-theme-scope-badge--ui">{t('settings.theme.scope.ui')}</span>
        </div>
        <p className="prefs-theme-extension-description">{t('settings.theme.cssFile.folderDescription')}</p>
      </div>

      <p className="prefs-theme-extension-status" role="status">
        {activeCssTheme
          ? t('settings.theme.cssFile.activeMessage', { file: activeCssTheme })
          : t('settings.theme.cssFile.inactiveMessage')}
      </p>

      <div className="settings-inline-controls prefs-theme-extension-actions">
        <SettingsButton type="button" variant="secondary" onClick={() => void onOpenFolder()}>
          {t('menu.native.themeOpenFolder')}
        </SettingsButton>
        <SettingsButton type="button" variant="secondary" onClick={() => void onRescan()}>
          {t('menu.native.themeRefreshCss')}
        </SettingsButton>
      </div>
    </SettingsCard>
  )
}
