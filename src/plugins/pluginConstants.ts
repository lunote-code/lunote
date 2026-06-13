import { PLUGIN_CATALOG_CONFIG } from './pluginCatalogConfig'

/**
 * Plugin catalog base URL (no trailing slash).
 *
 * The configured source may be a same-origin path, GitHub repository URL,
 * GitHub Raw URL, or GitHub Pages URL.
 */
function normalizeCatalogBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return ''
  return trimmed.replace(/\/$/, '')
}

function resolveGitHubRepoCatalogBaseUrl(source: string): string {
  const match = source.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i)
  if (!match) return source
  const [, owner, repo] = match
  return `https://raw.githubusercontent.com/${owner}/${repo}/main`
}

function resolveCatalogFetchBaseUrl(source: string): string {
  if (!source) return ''
  if (source.startsWith('/')) return source
  return resolveGitHubRepoCatalogBaseUrl(source)
}

function resolveConfiguredCatalogSourceUrl(): string {
  const useLocalDevCatalog =
    import.meta.env.DEV && import.meta.env.VITE_PLUGIN_CATALOG_LOCAL === '1'
  return normalizeCatalogBaseUrl(
    useLocalDevCatalog
      ? PLUGIN_CATALOG_CONFIG.development.baseUrl
      : PLUGIN_CATALOG_CONFIG.production.baseUrl,
  )
}

const configuredCatalogSourceUrl = resolveConfiguredCatalogSourceUrl()

export const PLUGIN_CATALOG_SOURCE_URL = configuredCatalogSourceUrl

export const PLUGIN_CATALOG_BASE_URL = resolveCatalogFetchBaseUrl(configuredCatalogSourceUrl)

export const PLUGIN_CATALOG_INDEX_URL = PLUGIN_CATALOG_BASE_URL
  ? `${PLUGIN_CATALOG_BASE_URL}/catalog/index.json`
  : ''

export const PLUGINS_INSTALLED_STORAGE_KEY = 'Lunote:plugins:installed:v1'

const LOCAL_CATALOG_ORIGINS = Array.from(
  new Set([
    PLUGIN_CATALOG_CONFIG.development.proxyTarget.replace(/\/$/, ''),
    'http://127.0.0.1:8000',
    'http://localhost:8000',
  ]),
)

export function isPluginCatalogConfigured(): boolean {
  return PLUGIN_CATALOG_SOURCE_URL.length > 0
}

/** User-visible catalog source (absolute URL when base is a same-origin path). */
export function formatPluginCatalogSourceLabel(origin = ''): string {
  if (!PLUGIN_CATALOG_SOURCE_URL) return ''
  if (PLUGIN_CATALOG_SOURCE_URL.startsWith('/')) {
    return origin
      ? `${origin.replace(/\/$/, '')}${PLUGIN_CATALOG_SOURCE_URL}`
      : PLUGIN_CATALOG_SOURCE_URL
  }
  return PLUGIN_CATALOG_SOURCE_URL
}

function usesSameOriginCatalogProxy(): boolean {
  return PLUGIN_CATALOG_BASE_URL.startsWith('/')
}

const LEGACY_CDN_PLUGIN_ICON_RE =
  /^https:\/\/cdn\.lunote\.app\/plugins\/([a-z0-9-]+)\/icon(?:@(\d+))?\.png$/i

const LEGACY_CDN_PLUGIN_PACKAGE_RE =
  /^https:\/\/cdn\.lunote\.app\/packages\/([a-z0-9-]+)(?:-[\d.]+)?\.(?:zip|json)$/i

function resolveLegacyCdnPluginIconUrl(target: string, baseUrl: string): string | null {
  const match = target.match(LEGACY_CDN_PLUGIN_ICON_RE)
  if (!match) return null
  const [, pluginId, size] = match
  const iconFile = size ? `icon@${size}.png` : 'icon@128.png'
  return `${baseUrl.replace(/\/$/, '')}/media/${pluginId}/${iconFile}`
}

function resolveLegacyCdnPluginPackageUrl(target: string, baseUrl: string): string | null {
  const match = target.match(LEGACY_CDN_PLUGIN_PACKAGE_RE)
  if (!match) return null
  const [, pluginId] = match
  const packagePath = `/packages/${pluginId}.json`
  if (baseUrl.startsWith('/')) {
    return joinCatalogPathSegments(baseUrl.replace(/\/$/, ''), packagePath)
  }
  return `${baseUrl.replace(/\/$/, '')}${packagePath}`
}

function joinCatalogPathSegments(basePath: string, relativePath: string): string {
  const stack = basePath.split('/').filter((segment) => segment.length > 0)
  for (const segment of relativePath.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return `/${stack.join('/')}`
}

/** Directory containing `catalog/index.json`, used to resolve relative catalog links. */
export function pluginCatalogDirectoryFromIndexUrl(
  indexUrl: string = PLUGIN_CATALOG_INDEX_URL,
): string {
  const trimmed = indexUrl.trim()
  if (!trimmed) {
    return PLUGIN_CATALOG_BASE_URL ? `${PLUGIN_CATALOG_BASE_URL}/catalog/` : ''
  }
  if (trimmed.endsWith('/catalog/index.json')) {
    return trimmed.slice(0, -'index.json'.length)
  }
  if (trimmed.endsWith('/index.json')) {
    return trimmed.slice(0, trimmed.lastIndexOf('/') + 1)
  }
  const base = trimmed.replace(/\/$/, '')
  return `${base}/catalog/`
}

function resolveRelativeCatalogUrl(target: string, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  if (base.startsWith('/')) {
    return joinCatalogPathSegments(base, target)
  }
  return new URL(target, base).toString()
}

/** Normalize catalog URLs from index/detail JSON (absolute or relative). */
export function resolvePluginCatalogUrl(target: string, baseUrl = PLUGIN_CATALOG_BASE_URL): string {
  if (!target) return baseUrl
  if (!baseUrl) return target

  if (/^https?:\/\//i.test(target)) {
    const legacyIcon = resolveLegacyCdnPluginIconUrl(target, baseUrl)
    if (legacyIcon) return legacyIcon

    const legacyPackage = resolveLegacyCdnPluginPackageUrl(target, baseUrl)
    if (legacyPackage) return legacyPackage

    if (usesSameOriginCatalogProxy()) {
      for (const origin of LOCAL_CATALOG_ORIGINS) {
        if (target.startsWith(origin)) {
          return `${baseUrl}${target.slice(origin.length)}`
        }
      }
    }
    return target
  }

  if (target.startsWith('/')) {
    if (baseUrl.startsWith('/')) {
      return joinCatalogPathSegments(baseUrl.replace(/\/$/, ''), target)
    }
    return `${baseUrl.replace(/\/$/, '')}${target}`
  }

  return resolveRelativeCatalogUrl(target, baseUrl)
}
