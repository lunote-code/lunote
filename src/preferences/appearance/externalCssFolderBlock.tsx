import type { TranslateFn } from '../../i18n'
import { SettingsButton } from '../../components/settings'
import { SettingsHelpPopover, SettingsInlineHelp } from '../../components/settings/SettingsHelpPopover'

type Props = {
  t: TranslateFn
  activeCssTheme: string | null
  onOpenFolder: () => void
  onRescan: () => void
}

export function ExternalCssFolderBlock({ t, activeCssTheme, onOpenFolder, onRescan }: Props) {
  const title = t('settings.theme.cssFile.folderTitle')
  const helpBody = t('settings.theme.cssFile.folderDescription')

  return (
    <div className="prefs-theme-extension prefs-theme-extension-block">
      <div className="prefs-theme-extension-header">
        <div className="prefs-theme-extension-heading">
          <h5 className="prefs-theme-extension-title">
            <SettingsInlineHelp
              label={title}
              help={<SettingsHelpPopover title={title} body={helpBody} />}
            />
          </h5>
          <span className="prefs-theme-scope-badge prefs-theme-scope-badge--ui">{t('settings.theme.scope.ui')}</span>
        </div>
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
    </div>
  )
}
