import {
  docKeyFromWikiTarget,
  getDocumentMeta,
  normalizeDocKeyForNavigation,
  resolveCanonicalIdentity,
  resolveHeadingTarget,
} from '../knowledgeRuntime'
import type { DocKey, WikiLinkTarget } from '../knowledgeRuntime/types'
import { docKeyToAbsolutePath, noteTitleFromDocKey } from './vaultRuntime'
import type { ResolvedWikiLink } from './types'

/**
 * Resolve wiki target as docKey (not called in render path; dispatched by navigation / indexer).
 */
export function resolveWikiTarget(target: WikiLinkTarget): ResolvedWikiLink {
  const navigationKey = normalizeDocKeyForNavigation(target.docKey)
  const rawKey = docKeyFromWikiTarget(navigationKey)
  const identity = resolveCanonicalIdentity(navigationKey)
  const headingTarget =
    !target.heading && !target.blockId
      ? resolveHeadingTarget(rawKey)
      : null
  const resolvedDocKey =
    identity.status === 'resolved'
      ? identity.docKey
      : headingTarget?.hostDocKey ?? null

  const heading = target.heading ?? headingTarget?.heading
  const blockId = target.blockId

  const meta = resolvedDocKey ? getDocumentMeta(resolvedDocKey) : undefined
  const absolutePath = meta?.absolutePath ?? (resolvedDocKey ? docKeyToAbsolutePath(resolvedDocKey) : null)
  const displayLabel =
    target.alias?.trim() ||
    meta?.title ||
    noteTitleFromDocKey(resolvedDocKey ?? rawKey)

  return {
    rawTarget: { ...target, docKey: resolvedDocKey ?? navigationKey, heading, blockId },
    resolvedDocKey,
    absolutePath,
    displayLabel,
    exists: !!resolvedDocKey && !!absolutePath,
  }
}

export function resolveWikiLinkFromRaw(raw: string): ResolvedWikiLink | null {
  const m = /(!)?\[\[([^\]|#^]+?)(?:#([^\]|^]+?))?(?:\^([^\]]+?))?(?:\|([^\]]+?))?\]\]/.exec(raw)
  if (!m) return null
  return resolveWikiTarget({
    docKey: m[2]!,
    heading: m[3]?.trim() || undefined,
    blockId: m[4]?.trim() || undefined,
    alias: m[5]?.trim() || undefined,
  })
}

export function isWikiLinkResolvable(docKey: DocKey): boolean {
  return resolveCanonicalIdentity(docKey).status === 'resolved'
}
