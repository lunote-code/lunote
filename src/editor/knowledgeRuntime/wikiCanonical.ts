import type { DocKey } from './types'

const MD_ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|])/g

/** Path-level preprocessing: trim, URI, remove .md, unify slashes (not slug).*/
export function normalizeWikiPath(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  try {
    s = decodeURIComponent(s)
  } catch {
    /* keep */
  }
  s = s.replace(/\\/g, '/').replace(/^\/+/u, '').replace(/\.md$/iu, '')
  return s
}

/** Single paragraph title slug: Obsidian style canonical docKey snippet.*/
export function canonicalizeWikiSegment(segment: string): string {
  let t = segment.normalize('NFKC').trim().toLowerCase()
  t = t.replace(MD_ESCAPE_RE, '$1')
  t = t.replace(/\s+/g, '-')
  t = t.replace(/-+/g, '-')
  t = t.replace(/^-+|-+$/g, '')
  return t
}

/**
 * Wiki link target canonicalization (for incoming/outgoing graph keys).
 */
export function canonicalizeWikiLinkText(raw: string): string {
  const path = normalizeWikiPath(raw)
  if (!path) return path
  const segments = path.split('/').map(canonicalizeWikiSegment).filter(Boolean)
  return segments.join('/')
}

/** Active Document docKey → Graph incoming/outgoing query key (no registry lookup).*/
export function canonicalDocKeyForGraph(docKey: DocKey): DocKey {
  return canonicalizeWikiLinkText(docKey)
}
