import { resolveDocKey } from './knowledgeRegistry'
import { resolveCanonicalIdentity } from './canonicalIdentity'
import {
  canonicalizeWikiLinkText,
  canonicalDocKeyForGraph as canonicalKeyFromText,
} from './wikiCanonical'
import type { CanonicalDocumentTarget, DocKey } from './types'

export { canonicalizeWikiLinkText, canonicalizeWikiSegment, normalizeWikiPath } from './wikiCanonical'

/**
 * Resolve [[Graph Theory]] / aliases to unified graph/backlink target model.
 */
export function resolveWikiLinkTarget(rawLinkText: string): CanonicalDocumentTarget {
  const identity = resolveCanonicalIdentity(rawLinkText)
  const canonical = canonicalizeWikiLinkText(rawLinkText)
  const target: CanonicalDocumentTarget = {
    ...identity,
    canonical,
    label: rawLinkText,
  }

  if (import.meta.env.DEV) {
    console.debug('[WikiResolve]', {
      raw: rawLinkText,
      canonical,
      matchedDoc: identity.status === 'resolved' ? identity.docKey : null,
      target,
    })
  }

  return target
}

export function resolveWikiLinkTargetDocKey(rawLinkText: string): DocKey | null {
  const target = resolveWikiLinkTarget(rawLinkText)
  return target.status === 'resolved' ? target.docKey : null
}

/** Active document docKey → graph incoming/outgoing query key.*/
export function canonicalDocKeyForGraph(docKey: DocKey): DocKey {
  if (!docKey) return docKey
  const matched = resolveDocKey(docKey)
  return matched ? canonicalizeWikiLinkText(matched) : canonicalKeyFromText(docKey)
}

export function linkTargetMatchesDoc(linkTargetDocKey: DocKey, docKey: DocKey): boolean {
  if (!linkTargetDocKey || !docKey) return false
  return resolveWikiLinkTargetDocKey(linkTargetDocKey) === resolveDocKey(docKey)
}
