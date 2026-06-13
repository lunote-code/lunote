import {
  isPluginCatalogConfigured,
  PLUGIN_CATALOG_INDEX_URL,
  pluginCatalogDirectoryFromIndexUrl,
  resolvePluginCatalogUrl,
} from './pluginConstants'
import type { PluginCatalogDetail, PluginCatalogIndex } from './pluginTypes'

export async function fetchPluginCatalogIndex(
  indexUrl = PLUGIN_CATALOG_INDEX_URL,
): Promise<PluginCatalogIndex> {
  if (!isPluginCatalogConfigured() && !indexUrl) {
    throw new Error('Plugin catalog URL is not configured')
  }
  const response = await fetch(indexUrl, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Plugin catalog request failed (${response.status})`)
  }
  return (await response.json()) as PluginCatalogIndex
}

export async function fetchPluginCatalogDetail(
  detailUrl: string,
  catalogBaseUrl = PLUGIN_CATALOG_INDEX_URL,
): Promise<PluginCatalogDetail> {
  const resolved = resolvePluginCatalogUrl(detailUrl, pluginCatalogDirectoryFromIndexUrl(catalogBaseUrl))
  const response = await fetch(resolved, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Plugin detail request failed (${response.status})`)
  }
  return (await response.json()) as PluginCatalogDetail
}
