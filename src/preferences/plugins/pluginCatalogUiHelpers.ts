import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import { APP_VERSION } from '../../app/workspace/constants'
import {
  formatPluginCatalogSourceLabel,
  resolvePluginCatalogUrl,
} from '../../plugins/pluginConstants'
import { pickLocalizedText } from '../../plugins/pluginLocalizedText'
import type {
  LocalizedString,
  PluginCatalogDetail,
  PluginCatalogIndexEntry,
  PluginPermissionSet,
} from '../../plugins/pluginTypes'
import { comparePluginVersions } from '../../plugins/pluginVersion'

export type PluginCompatibility = 'compatible' | 'appTooOld' | 'appTooNew'

export function resolvePluginCategoryLabel(
  categoryId: string,
  categories: Record<string, LocalizedString>,
  locale: UiLocaleId,
  t: TranslateFn,
): string {
  if (categoryId === 'installed') return t('settings.plugins.tabInstalled')
  const label = categories[categoryId]
  if (label) return pickLocalizedText(label, locale)
  return categoryId
}

export function formatPluginTypeLabel(pluginType: string | undefined, t: TranslateFn): string | null {
  if (!pluginType) return null
  const key = `settings.plugins.type.${pluginType}` as const
  const translated = t(key)
  return translated === key ? pluginType : translated
}

export function formatPluginCapabilityLabel(capability: string, t: TranslateFn): string {
  const key = `settings.plugins.capability.${capability}` as const
  const translated = t(key)
  return translated === key ? capability : translated
}

export function listPluginPermissionLabels(
  permissions: PluginPermissionSet | undefined,
  t: TranslateFn,
): string[] {
  if (!permissions) return []
  if (Array.isArray(permissions)) {
    return permissions.map((entry) => {
      const key = `settings.plugins.permission.${entry}` as const
      const translated = t(key)
      return translated === key ? entry : translated
    })
  }

  const labels: string[] = []
  if (permissions.theme?.register) {
    labels.push(t('settings.plugins.permission.themeRegister'))
  }
  const networkHosts = permissions.network?.hosts
  if (Array.isArray(networkHosts) && networkHosts.length > 0) {
    labels.push(t('settings.plugins.permission.network', { hosts: networkHosts.join(', ') }))
  }
  const readPaths = permissions.filesystem?.read
  if (Array.isArray(readPaths) && readPaths.length > 0) {
    labels.push(t('settings.plugins.permission.filesystemRead', { paths: readPaths.join(', ') }))
  }
  const writePaths = permissions.filesystem?.write
  if (Array.isArray(writePaths) && writePaths.length > 0) {
    labels.push(t('settings.plugins.permission.filesystemWrite', { paths: writePaths.join(', ') }))
  }
  return labels
}

export function evaluatePluginCompatibility(
  minAppVersion?: string,
  maxAppVersion?: string | null,
  appVersion: string = APP_VERSION,
): PluginCompatibility {
  if (minAppVersion && comparePluginVersions(appVersion, minAppVersion) < 0) return 'appTooOld'
  if (maxAppVersion && comparePluginVersions(appVersion, maxAppVersion) > 0) return 'appTooNew'
  return 'compatible'
}

export function resolvePluginMinAppVersion(
  rowMinAppVersion: string | undefined,
  detail: PluginCatalogDetail | null,
  latestVersion: string,
): string | undefined {
  const fromVersion = detail?.versions.find((entry) => entry.version === latestVersion)?.minAppVersion
  return fromVersion ?? rowMinAppVersion
}

export function resolvePluginMaxAppVersion(
  rowMaxAppVersion: string | null | undefined,
  detail: PluginCatalogDetail | null,
  latestVersion: string,
): string | null | undefined {
  const fromVersion = detail?.versions.find((entry) => entry.version === latestVersion)?.maxAppVersion
  if (fromVersion !== undefined) return fromVersion
  return rowMaxAppVersion
}

export function resolvePluginChangelogText(
  changelog: Record<string, LocalizedString> | undefined,
  version: string,
  locale: UiLocaleId,
): string | null {
  if (!changelog) return null
  const direct = changelog[version]
  if (direct) return pickLocalizedText(direct, locale)
  const sortedVersions = Object.keys(changelog).sort((left, right) => comparePluginVersions(right, left))
  const fallback = sortedVersions[0]
  return fallback ? pickLocalizedText(changelog[fallback], locale) : null
}

export function formatPluginPlatformLabels(platforms: string[] | undefined, t: TranslateFn): string[] {
  return (platforms ?? []).map((platform) => {
    const key = `settings.plugins.platform.${platform}` as const
    const translated = t(key)
    return translated === key ? platform : translated
  })
}

export function formatPluginPackageSize(sizeBytes: number | undefined, t: TranslateFn): string | null {
  if (sizeBytes == null || sizeBytes <= 0) return null
  if (sizeBytes < 1024) return t('settings.plugins.sizeBytes', { size: String(sizeBytes) })
  if (sizeBytes < 1024 * 1024) {
    return t('settings.plugins.sizeKilobytes', { size: (sizeBytes / 1024).toFixed(1) })
  }
  return t('settings.plugins.sizeMegabytes', { size: (sizeBytes / (1024 * 1024)).toFixed(1) })
}

export function resolveLatestPackageSize(detail: PluginCatalogDetail | null, latestVersion: string): number | undefined {
  const versionEntry =
    detail?.versions.find((entry) => entry.version === latestVersion) ?? detail?.versions[0]
  return versionEntry?.sizeBytes
}

export type PluginCatalogScreenshot =
  NonNullable<NonNullable<PluginCatalogDetail['media']>['screenshots']>[number]

export function pluginHasExplicitIcon(
  row: PluginCatalogIndexEntry,
  detail?: PluginCatalogDetail | null,
): boolean {
  if (row.iconExplicit === true) return Boolean(row.icon?.trim())
  if (detail?.media?.iconExplicit === true) {
    const mediaIcon = detail.media.icon
    if (mediaIcon && typeof mediaIcon === 'object') {
      return Object.values(mediaIcon).some((value) => typeof value === 'string' && value.trim().length > 0)
    }
  }
  return false
}

export function resolvePluginIconUrl(
  row: PluginCatalogIndexEntry,
  detail?: PluginCatalogDetail | null,
): string | null {
  if (row.iconExplicit && row.icon?.trim()) return row.icon.trim()
  if (detail?.media?.iconExplicit && detail.media.icon) {
    const preferred =
      detail.media.icon['128'] ??
      detail.media.icon['32'] ??
      Object.values(detail.media.icon).find((value) => typeof value === 'string' && value.trim())
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
  }
  return null
}

export type PluginIconDisplay =
  | { kind: 'letter'; label: string }
  | { kind: 'image'; src: string }

export function resolvePluginIconDisplay(
  row: PluginCatalogIndexEntry,
  options: { iconBroken?: boolean; detail?: PluginCatalogDetail | null } = {},
): PluginIconDisplay {
  const label = row.name.trim().slice(0, 1).toUpperCase() || '?'
  const iconBroken = options.iconBroken ?? false
  if (!pluginHasExplicitIcon(row, options.detail)) {
    return { kind: 'letter', label }
  }
  const iconUrl = resolvePluginIconUrl(row, options.detail)
  if (!iconUrl || iconBroken) {
    return { kind: 'letter', label }
  }
  return { kind: 'image', src: resolvePluginCatalogUrl(iconUrl) }
}

export function collectPluginCatalogScreenshots(
  detail: PluginCatalogDetail | null,
): PluginCatalogScreenshot[] {
  const screenshots = (detail?.media?.screenshots ?? []).filter((shot) => shot.url.trim().length > 0)
  const banner = detail?.media?.banner?.trim()
  if (!banner || screenshots.some((shot) => shot.url === banner)) return screenshots
  return [{ url: banner }, ...screenshots]
}

export function resolvePluginSourceLabel(): string {
  if (typeof window !== 'undefined') {
    return formatPluginCatalogSourceLabel(window.location.origin)
  }
  return formatPluginCatalogSourceLabel()
}

export function formatPluginImpactScope(
  pluginType: string | undefined,
  capabilities: string[] | undefined,
  t: TranslateFn,
): string | null {
  const labels = new Set<string>()
  const typeLabel = formatPluginTypeLabel(pluginType, t)
  if (typeLabel) labels.add(typeLabel)
  for (const capability of capabilities ?? []) {
    labels.add(formatPluginCapabilityLabel(capability, t))
  }
  return labels.size > 0 ? [...labels].join(', ') : null
}
