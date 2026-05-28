import type { AssetDisplayPathContext } from './assetDisplayPath'
import { formatAssetDisplayPath } from './assetDisplayPath'
import type { AssetMeta } from './workspaceAssetStore'
import { lunaAssetFileKindFromName, lunaAssetLinkClassForKind } from './lunaAssetFileKind'

const LUNA_ASSET_SCHEME = 'luna-asset://'

export function createAssetMarkdownLink(asset: AssetMeta): string {
  return `[${escapeMarkdownLinkText(asset.originalName)}](${LUNA_ASSET_SCHEME}${asset.id})`
}

export function createAssetHtmlLink(asset: AssetMeta): string {
  const kind = lunaAssetFileKindFromName(asset.originalName)
  const kindClass = lunaAssetLinkClassForKind(kind)
  return `<a href="${LUNA_ASSET_SCHEME}${escapeHtmlAttr(asset.id)}" class="pm-link-inline ${kindClass}" data-luna-asset="1" data-luna-asset-ext="${kind}">${escapeHtmlText(asset.originalName)}</a>`
}

export function isLunaAssetHref(href: string | null | undefined): boolean {
  return Boolean(href?.startsWith(LUNA_ASSET_SCHEME))
}

export function parseAssetId(href: string): string | null {
  if (!isLunaAssetHref(href)) return null
  const id = href.slice(LUNA_ASSET_SCHEME.length).trim()
  return id || null
}

export function assetTooltip(asset: AssetMeta, ctx?: AssetDisplayPathContext): string {
  const path = formatAssetDisplayPath(asset, ctx)
  const mime = asset.mimeType || 'application/octet-stream'
  return `${path}\n${mime}`
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
}

function escapeHtmlAttr(text: string): string {
  return escapeHtmlText(text).replace(/"/gu, '&quot;')
}
