import type { TranslateFn } from '../../i18n'
import type { PluginCatalogDetail } from '../../plugins/pluginTypes'

export type PluginDetailLink = {
  id: string
  label: string
  href: string
}

export function isSafeExternalUrl(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function repositoryLinkLabel(href: string, t: TranslateFn): string {
  return /github\.com/i.test(href) ? 'GitHub' : t('settings.plugins.repositoryShort')
}

export function collectPluginDetailLinks(
  detail: PluginCatalogDetail | null,
  t: TranslateFn,
): PluginDetailLink[] {
  if (!detail) return []

  const seen = new Set<string>()
  const links: PluginDetailLink[] = []

  const add = (id: string, label: string, href: string | undefined) => {
    const normalized = href?.trim()
    if (!normalized || !isSafeExternalUrl(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    links.push({ id, label, href: normalized })
  }

  add('repository', repositoryLinkLabel(detail.repository ?? '', t), detail.repository)
  add('documentation', t('settings.plugins.documentationShort'), detail.documentation)
  add('homepage', t('settings.plugins.homepageShort'), detail.homepage)

  return links
}
