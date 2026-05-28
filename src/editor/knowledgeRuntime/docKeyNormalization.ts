import type { DocKey } from './types'
import { canonicalizeWikiLinkText } from './wikiCanonical'

const UNRESOLVED_PREFIX = 'unresolved:'

export function hasUnresolvedPrefix(docKey: string): boolean {
  return docKey.startsWith(UNRESOLVED_PREFIX)
}

export function stripUnresolvedPrefix(docKey: string): string {
  let normalized = docKey.trim()
  while (normalized.startsWith(UNRESOLVED_PREFIX)) {
    normalized = normalized.slice(UNRESOLVED_PREFIX.length).trim()
  }
  return normalized
}

/** Unified key for navigation links: remove unresolved packaging and retain parsable original semantics.*/
export function normalizeDocKeyForNavigation(docKey: string): DocKey {
  return stripUnresolvedPrefix(docKey)
}

/** Index/comparison link unified key: navigation normalized and then canonical.*/
export function normalizeDocKeyForComparison(docKey: string): DocKey {
  return canonicalizeWikiLinkText(normalizeDocKeyForNavigation(docKey))
}

