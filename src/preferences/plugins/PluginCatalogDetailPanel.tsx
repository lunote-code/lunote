import type { Ref } from 'react'

import { SettingsButton } from '../../components/settings'
import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import { pickLocalizedText } from '../../plugins/pluginLocalizedText'
import type { LocalizedString, PluginCatalogDetail, PluginCatalogIndexEntry } from '../../plugins/pluginTypes'
import {
  type PluginCompatibility,
  formatPluginImpactScope,
  formatPluginCapabilityLabel,
  formatPluginPackageSize,
  formatPluginPlatformLabels,
  formatPluginTypeLabel,
  listPluginPermissionLabels,
  resolvePluginSourceLabel,
  resolveLatestPackageSize,
  resolvePluginCategoryLabel,
  resolvePluginChangelogText,
  resolvePluginMaxAppVersion,
  resolvePluginMinAppVersion,
  collectPluginCatalogScreenshots,
} from './pluginCatalogUiHelpers'
import { collectPluginDetailLinks, isSafeExternalUrl } from './pluginDetailLinks'
import { PreferencesNotice } from '../PreferencesNotice'
import { PluginVerifiedMark } from './PluginVerifiedMark'
import { PluginScreenshotCarousel } from './PluginScreenshotCarousel'

type Props = {
  row: PluginCatalogIndexEntry
  detail: PluginCatalogDetail | null
  detailLoading: boolean
  detailError: string | null
  effectiveLocale: UiLocaleId
  categories: Record<string, LocalizedString>
  installed: boolean
  updateAvailable: boolean
  installedVersion?: string
  installing: boolean
  uninstalling: boolean
  compatibility: PluginCompatibility
  overlayMode?: boolean
  t: TranslateFn
  onClose: () => void
  onRetryDetail: () => void
  onRequestInstall: () => void
  onRequestUpdate: () => void
  onUninstall: () => void
  panelRef?: Ref<HTMLElement>
  closeButtonRef?: Ref<HTMLButtonElement>
}

function normalizeCopy(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function PluginCatalogDetailPanel({
  row,
  detail,
  detailLoading,
  detailError,
  effectiveLocale,
  categories,
  installed,
  updateAvailable,
  installedVersion,
  installing,
  uninstalling,
  compatibility,
  overlayMode = false,
  t,
  onClose,
  onRetryDetail,
  onRequestInstall,
  onRequestUpdate,
  onUninstall,
  panelRef,
  closeButtonRef,
}: Props) {
  const tagline = pickLocalizedText(row.tagline, effectiveLocale)
  const description = detail ? pickLocalizedText(detail.description, effectiveLocale) : ''
  const supplement =
    description && normalizeCopy(description) !== normalizeCopy(tagline) ? description : ''
  const categoryLabel = resolvePluginCategoryLabel(row.category, categories, effectiveLocale, t)
  const screenshots = collectPluginCatalogScreenshots(detail)
  const displayVersion = updateAvailable ? row.latestVersion : (installedVersion ?? row.latestVersion)
  const detailLinks = collectPluginDetailLinks(detail, t)
  const showScreenshots = !detailLoading && !detailError && screenshots.length > 0
  const detailUnavailable = !detailLoading && !detailError && !detail && !row.detailUrl
  const authorName = detail?.author.name ?? row.author
  const authorUrl = detail?.author.url?.trim()
  const safeAuthorUrl = authorUrl && isSafeExternalUrl(authorUrl) ? authorUrl : undefined
  const pluginTypeLabel = formatPluginTypeLabel(row.pluginType ?? detail?.pluginType, t)
  const capabilityLabels = (row.capabilities ?? detail?.capabilities ?? []).map((entry) =>
    formatPluginCapabilityLabel(entry, t),
  )
  const permissionLabels = listPluginPermissionLabels(detail?.permissions, t)
  const experimental = detail?.experimental ?? row.experimental
  const requiresRestart = detail?.requiresRestart ?? row.requiresRestart
  const platforms = formatPluginPlatformLabels(detail?.platforms ?? row.platforms, t)
  const minAppVersion = resolvePluginMinAppVersion(row.minAppVersion, detail, row.latestVersion)
  const maxAppVersion = resolvePluginMaxAppVersion(row.maxAppVersion, detail, row.latestVersion)
  const packageSize = formatPluginPackageSize(
    resolveLatestPackageSize(detail, row.latestVersion),
    t,
  )
  const changelogText = resolvePluginChangelogText(detail?.changelog, displayVersion, effectiveLocale)
  const license = detail?.license?.trim()
  const impactScope = formatPluginImpactScope(
    row.pluginType ?? detail?.pluginType,
    row.capabilities ?? detail?.capabilities,
    t,
  )
  const sourceLabel = resolvePluginSourceLabel()
  const compatibilityBlocked = compatibility !== 'compatible'

  return (
    <aside
      ref={panelRef}
      className={`prefs-plugin-detail${overlayMode ? ' prefs-plugin-detail--overlay' : ''}`}
      role={overlayMode ? 'dialog' : 'complementary'}
      aria-modal={overlayMode ? true : undefined}
      aria-labelledby={`prefs-plugin-detail-title-${row.id}`}
    >
      <div className="prefs-plugin-detail-header">
        <div className="prefs-plugin-detail-title-row">
          <h3 id={`prefs-plugin-detail-title-${row.id}`} className="prefs-plugin-detail-title">
            {row.name}
          </h3>
          {row.verified ? <PluginVerifiedMark t={t} /> : null}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="prefs-plugin-detail-close"
          onClick={onClose}
          aria-label={t('settings.plugins.closeDetail')}
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      <div className="prefs-plugin-detail-body">
        <div className="prefs-plugin-detail-intro">
          {detailLoading ? (
            <p className="prefs-plugin-detail-muted">{t('settings.plugins.detailLoading')}</p>
          ) : detailError ? (
            <div className="prefs-plugin-inline-notice">
              <PreferencesNotice tone="error" role="alert">
                {t('settings.plugins.error', { message: detailError })}
              </PreferencesNotice>
              <SettingsButton variant="ghost" className="prefs-plugin-action-btn" onClick={onRetryDetail}>
                <Icon name="refresh" size="sm" />
                {t('settings.plugins.retry')}
              </SettingsButton>
            </div>
          ) : detailUnavailable ? (
            <p className="prefs-plugin-detail-muted">{t('settings.plugins.detailUnavailable')}</p>
          ) : (
            <p className="prefs-plugin-detail-lead">{tagline}</p>
          )}

          <p className="prefs-plugin-detail-meta">
            {safeAuthorUrl ? (
              <a className="prefs-plugin-detail-link" href={safeAuthorUrl} target="_blank" rel="noreferrer">
                {authorName}
              </a>
            ) : (
              <span>{authorName}</span>
            )}
            <span className="prefs-plugin-detail-meta-sep" aria-hidden="true">
              ·
            </span>
            <span>v{displayVersion}</span>
            {updateAvailable && installedVersion ? (
              <>
                <span className="prefs-plugin-detail-meta-sep" aria-hidden="true">
                  ·
                </span>
                <span>{t('settings.plugins.installedVersion', { version: installedVersion })}</span>
              </>
            ) : null}
            <span className="prefs-plugin-detail-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="prefs-plugin-detail-category">{categoryLabel}</span>
          </p>

          {pluginTypeLabel || capabilityLabels.length > 0 ? (
            <div className="prefs-plugin-detail-chips" aria-label={t('settings.plugins.capabilities')}>
              {pluginTypeLabel ? (
                <span className="prefs-plugin-capability-chip">{pluginTypeLabel}</span>
              ) : null}
              {capabilityLabels.map((label) => (
                <span key={label} className="prefs-plugin-capability-chip">
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          {installed || updateAvailable || experimental || requiresRestart ? (
            <div className="prefs-plugin-detail-badges">
              {installed ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--muted">{t('settings.plugins.installed')}</span>
              ) : null}
              {updateAvailable ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--update">{t('settings.plugins.updateAvailable')}</span>
              ) : null}
              {experimental ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--update">{t('settings.plugins.experimental')}</span>
              ) : null}
              {requiresRestart ? (
                <span className="prefs-plugin-badge prefs-plugin-badge--muted">{t('settings.plugins.requiresRestart')}</span>
              ) : null}
            </div>
          ) : null}

          {!detailLoading && !detailError && compatibility !== 'compatible' ? (
            <PreferencesNotice tone="error" role="alert">
              {compatibility === 'appTooOld'
                ? t('settings.plugins.compatibilityAppTooOld', { version: minAppVersion ?? '' })
                : t('settings.plugins.compatibilityAppTooNew', { version: maxAppVersion ?? '' })}
            </PreferencesNotice>
          ) : null}

          <div className="prefs-plugin-detail-action-wrap">
            {updateAvailable ? (
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-detail-action prefs-plugin-detail-action--primary"
                disabled={installing || compatibilityBlocked}
                onClick={() => void onRequestUpdate()}
              >
                <Icon name="refresh" size="sm" tone="accent" className={installing ? 'luna-spin' : undefined} />
                {installing ? t('settings.plugins.updating') : t('settings.plugins.update')}
              </SettingsButton>
            ) : installed ? (
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-detail-action prefs-plugin-detail-action--danger"
                disabled={uninstalling}
                onClick={() => void onUninstall()}
              >
                <Icon name="delete" size="sm" tone="muted" className={uninstalling ? 'luna-spin' : undefined} />
                {uninstalling ? t('settings.plugins.uninstalling') : t('settings.plugins.uninstall')}
              </SettingsButton>
            ) : (
              <SettingsButton
                variant="ghost"
                className="prefs-plugin-detail-action prefs-plugin-detail-action--primary"
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

          {!detailLoading && !detailError && supplement ? (
            <p className="prefs-plugin-detail-description">{supplement}</p>
          ) : null}

          {!detailLoading && !detailError && permissionLabels.length > 0 ? (
            <div className="prefs-plugin-detail-permissions">
              <h4 className="prefs-plugin-detail-section-title">{t('settings.plugins.permissions')}</h4>
              <ul className="prefs-plugin-detail-list">
                {permissionLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!detailLoading && !detailError && (platforms.length > 0 || license || packageSize || minAppVersion || impactScope || sourceLabel) ? (
            <div className="prefs-plugin-detail-info">
              {sourceLabel ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.source')}</span>
                  <span>{sourceLabel}</span>
                </p>
              ) : null}
              {impactScope ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.impactScope')}</span>
                  <span>{impactScope}</span>
                </p>
              ) : null}
              {platforms.length > 0 ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.platforms')}</span>
                  <span>{platforms.join(', ')}</span>
                </p>
              ) : null}
              {license ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.license')}</span>
                  <span>{license}</span>
                </p>
              ) : null}
              {packageSize ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.packageSize')}</span>
                  <span>{packageSize}</span>
                </p>
              ) : null}
              {minAppVersion ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.minAppVersion')}</span>
                  <span>{minAppVersion}</span>
                </p>
              ) : null}
              {maxAppVersion ? (
                <p className="prefs-plugin-detail-info-row">
                  <span className="prefs-plugin-detail-info-label">{t('settings.plugins.maxAppVersion')}</span>
                  <span>{maxAppVersion}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {!detailLoading && !detailError && changelogText ? (
            <div className="prefs-plugin-detail-changelog">
              <h4 className="prefs-plugin-detail-section-title">
                {t('settings.plugins.changelog', { version: displayVersion })}
              </h4>
              <p className="prefs-plugin-detail-changelog-body">{changelogText}</p>
            </div>
          ) : null}
        </div>

        {showScreenshots ? (
          <>
            <div className="prefs-plugin-detail-divider" role="presentation" />
            <PluginScreenshotCarousel screenshots={screenshots} effectiveLocale={effectiveLocale} t={t} />
          </>
        ) : null}

        {detailLinks.length > 0 ? (
          <>
            <div className="prefs-plugin-detail-divider" role="presentation" />
            <nav className="prefs-plugin-detail-links" aria-label={t('settings.plugins.detailLinks')}>
              {detailLinks.map((link, index) => (
                <span key={link.id} className="prefs-plugin-detail-links-item">
                  {index > 0 ? (
                    <span className="prefs-plugin-detail-links-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <a className="prefs-plugin-detail-link" href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </span>
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </aside>
  )
}
