import type { TranslateFn } from '../../i18n'
import { SettingsButton, SettingsCard } from '../../components/settings'

export type ThemeExtensionEntry = {
  name: string
}

type Props = {
  t: TranslateFn
  scope: 'ui' | 'export'
  titleKey: string
  descriptionKey: string
  statusActiveKey: string
  statusInactiveKey: string
  statusCountParam?: string
  activeCount: number
  entries: readonly ThemeExtensionEntry[]
  activeNames: ReadonlySet<string>
  emptyCatalogKey: string
  openFolderLabelKey: string
  rescanLabelKey: string
  enableLabelKey: string
  disableLabelKey: string
  onOpenFolder: () => void
  onRescan: () => void
  onToggle: (name: string) => void
}

export function ThemeExtensionBlock({
  t,
  scope,
  titleKey,
  descriptionKey,
  statusActiveKey,
  statusInactiveKey,
  statusCountParam = 'count',
  activeCount,
  entries,
  activeNames,
  emptyCatalogKey,
  openFolderLabelKey,
  rescanLabelKey,
  enableLabelKey,
  disableLabelKey,
  onOpenFolder,
  onRescan,
  onToggle,
}: Props) {
  const scopeLabel =
    scope === 'ui' ? t('settings.theme.scope.ui') : t('settings.theme.scope.export')

  return (
    <SettingsCard tone="default" className="prefs-theme-extension">
      <div className="prefs-theme-extension-header">
        <div className="prefs-theme-extension-heading">
          <h5 className="prefs-theme-extension-title">{t(titleKey)}</h5>
          <span className={`prefs-theme-scope-badge prefs-theme-scope-badge--${scope}`}>{scopeLabel}</span>
        </div>
        <p className="prefs-theme-extension-description">{t(descriptionKey)}</p>
      </div>

      <p className="prefs-theme-extension-status" role="status">
        {activeCount > 0
          ? t(statusActiveKey, { [statusCountParam]: String(activeCount) })
          : t(statusInactiveKey)}
      </p>

      <div className="settings-inline-controls prefs-theme-extension-actions">
        <SettingsButton type="button" variant="secondary" onClick={() => void onOpenFolder()}>
          {t(openFolderLabelKey)}
        </SettingsButton>
        <SettingsButton type="button" variant="secondary" onClick={() => void onRescan()}>
          {t(rescanLabelKey)}
        </SettingsButton>
      </div>

      {entries.length > 0 ? (
        <ul className="prefs-theme-file-list" aria-label={t(titleKey)}>
          {entries.map((entry) => {
            const enabled = activeNames.has(entry.name)
            return (
              <li key={entry.name} className="prefs-theme-file-row">
                <span className="prefs-theme-file-name" title={entry.name}>
                  {entry.name}
                </span>
                <SettingsButton
                  type="button"
                  variant={enabled ? 'primary' : 'secondary'}
                  className="prefs-theme-file-toggle"
                  aria-pressed={enabled}
                  onClick={() => void onToggle(entry.name)}
                >
                  {enabled ? t(disableLabelKey) : t(enableLabelKey)}
                </SettingsButton>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="prefs-theme-extension-empty">{t(emptyCatalogKey)}</p>
      )}
    </SettingsCard>
  )
}
