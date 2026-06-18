import { SettingsButton, SettingsCard } from '../../components/settings'
import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import { pickLocalizedText } from '../../plugins/pluginLocalizedText'
import type { LocalizedString, PluginCatalogIndexEntry } from '../../plugins/pluginTypes'
import { PluginCatalogIcon } from './PluginCatalogIcon'
import {
  type PluginCompatibility,
  pluginHasExplicitIcon,
} from './pluginCatalogUiHelpers'
import { PluginVerifiedMark } from './PluginVerifiedMark'

type Props = {
  row: PluginCatalogIndexEntry
  effectiveLocale: UiLocaleId
  categories: Record<string, LocalizedString>
  installed: boolean
  installedVersion?: string
  updateAvailable: boolean
  installing: boolean
  uninstalling: boolean
  compatibility: PluginCompatibility
  selected: boolean
  iconBroken: boolean
  t: TranslateFn
  onOpenDetail: () => void
  onRequestInstall: () => void
  onRequestUpdate: () => void
  onUninstall: () => void
  onIconError: () => void
}

export function PluginCatalogCard({
  row,
  effectiveLocale,
  categories: _categories,
  installed,
  installedVersion: _installedVersion,
  updateAvailable,
  installing,
  uninstalling,
  compatibility,
  selected,
  iconBroken,
  t,
  onOpenDetail,
  onRequestInstall,
  onRequestUpdate,
  onUninstall,
  onIconError,
}: Props) {
  const tagline = pickLocalizedText(row.tagline, effectiveLocale)
  const showExplicitIcon = pluginHasExplicitIcon(row)
  const compatibilityBlocked = compatibility !== 'compatible'

  return (
    <SettingsCard
      className={`prefs-plugin-card${selected ? ' is-selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <button
        type="button"
        className="prefs-plugin-card-open"
        aria-label={t('settings.plugins.openDetail', { name: row.name })}
        onClick={onOpenDetail}
      >
        <PluginCatalogIcon
          row={row}
          iconBroken={iconBroken}
          onIconError={showExplicitIcon ? onIconError : undefined}
        />

        <div className="prefs-plugin-card-copy">
          <div className="prefs-plugin-card-title-row">
            <h3 className="prefs-plugin-card-title">{row.name}</h3>
            {row.verified ? <PluginVerifiedMark t={t} /> : null}
          </div>
          {installed || updateAvailable || compatibilityBlocked || row.requiresRestart ? (
            <div className="prefs-plugin-card-badges">
              {installed ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--muted">{t('settings.plugins.installed')}</span>
              ) : null}
              {updateAvailable ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--update">{t('settings.plugins.updateAvailable')}</span>
              ) : null}
              {compatibilityBlocked ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--danger">{t('settings.plugins.incompatible')}</span>
              ) : null}
              {row.requiresRestart ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--muted">{t('settings.plugins.requiresRestart')}</span>
              ) : null}
            </div>
          ) : null}
          <p className="prefs-plugin-card-tagline">{tagline}</p>
        </div>
      </button>

      <div className="prefs-plugin-card-actions">
        {updateAvailable ? (
          <SettingsButton
            variant="ghost"
            className="prefs-plugin-action-btn prefs-plugin-action-btn--install"
            disabled={installing || compatibilityBlocked}
            onClick={() => void onRequestUpdate()}
          >
            <Icon name="refresh" size="sm" tone="accent" className={installing ? 'luna-spin' : undefined} />
            {installing ? t('settings.plugins.updating') : t('settings.plugins.update')}
          </SettingsButton>
        ) : installed ? (
          <SettingsButton
            variant="ghost"
            className="prefs-plugin-action-btn prefs-plugin-action-btn--uninstall"
            disabled={uninstalling}
            onClick={() => void onUninstall()}
          >
            <Icon name="delete" size="sm" tone="muted" className={uninstalling ? 'luna-spin' : undefined} />
            {uninstalling ? t('settings.plugins.uninstalling') : t('settings.plugins.uninstall')}
          </SettingsButton>
        ) : (
          <SettingsButton
            variant="ghost"
            className="prefs-plugin-action-btn prefs-plugin-action-btn--install"
            disabled={installing || compatibilityBlocked}
            onClick={() => void onRequestInstall()}
          >
            <Icon
              name={installing ? 'refresh' : 'export'}
              size="sm"
              tone="accent"
              className={installing ? 'luna-spin' : undefined}
            />
            {installing ? t('settings.plugins.installing') : t('settings.plugins.install')}
          </SettingsButton>
        )}
      </div>
    </SettingsCard>
  )
}
