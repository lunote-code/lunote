import { getDocumentMetaByPath, resolveDocKey } from './knowledgeRegistry'
import { resolveHeadingTarget } from './headingLinkTargets'
import { canonicalizeWikiLinkText, normalizeWikiPath } from './wikiCanonical'
import { wikiLinkInnerTargetText } from './wikiLinkParser'

export type CanonicalDocIdentity = {
  docKey: string
  status: 'resolved' | 'unresolved'
  raw: string
}

const UNRESOLVED_PREFIX = 'unresolved:'

function unresolvedKeyFromRaw(raw: string): string {
  const normalized = normalizeWikiPath(raw)
  const canonical = canonicalizeWikiLinkText(normalized || raw)
  return `unresolved:${canonical || normalized || raw.trim()}`
}

export function resolveCanonicalIdentity(input: string): CanonicalDocIdentity {
  const raw = wikiLinkInnerTargetText(input.trim(), input.trim())
  if (raw.startsWith(UNRESOLVED_PREFIX)) {
    const identity: CanonicalDocIdentity = {
      docKey: raw,
      status: 'unresolved',
      raw: raw.slice(UNRESOLVED_PREFIX.length) || raw,
    }
    // #region agent log
    console.debug('[canonical-resolve]', { input, identity })
    // #endregion
    return identity
  }
  const normalized = normalizeWikiPath(raw)
  const canonical = canonicalizeWikiLinkText(normalized || raw)
  const pathMeta = getDocumentMetaByPath(raw)
  const resolved =
    pathMeta?.docKey ??
    resolveHeadingTarget(normalized)?.hostDocKey ??
    resolveHeadingTarget(canonical)?.hostDocKey ??
    resolveHeadingTarget(raw)?.hostDocKey ??
    resolveDocKey(normalized) ??
    resolveDocKey(canonical) ??
    resolveDocKey(raw)
  const identity: CanonicalDocIdentity = resolved
    ? { docKey: resolved, status: 'resolved', raw }
    : { docKey: unresolvedKeyFromRaw(raw), status: 'unresolved', raw }

  // #region agent log
  console.debug('[canonical-resolve]', { input, identity })
  // #endregion

  return identity
}
