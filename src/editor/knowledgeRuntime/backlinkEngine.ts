import {
  getDocumentMeta,
  getKnowledgeRegistryRevision,
  listDocumentMetas,
} from './knowledgeRegistry'
import { listHeadingCanonicalsForHost } from './headingLinkTargets'
import {
  getIncomingLinkRefsForDocPanel,
  getLinkGraphIndexRevision,
  linkTargetMatchesDoc,
  type LinkRef,
} from './linkGraphIndex'
import { normalizeDocKeyForComparison, normalizeDocKeyForNavigation } from './docKeyNormalization'
import type { BacklinkEntry, DocKey, ParsedWikiLink } from './types'

const backlinkCache = new Map<DocKey, BacklinkEntry[]>()
let cacheRegistryRevision = -1
let cacheLinkGraphRevision = -1

function ensureCacheFresh(): void {
  const registryRev = getKnowledgeRegistryRevision()
  const linkGraphRev = getLinkGraphIndexRevision()
  if (cacheRegistryRevision === registryRev && cacheLinkGraphRevision === linkGraphRev) return
  cacheRegistryRevision = registryRev
  cacheLinkGraphRevision = linkGraphRev
  backlinkCache.clear()
}

function linkRefToParsedWikiLink(ref: LinkRef): ParsedWikiLink {
  return {
    raw: ref.raw,
    kind: ref.kind,
    target: {
      docKey: ref.targetDocKey,
      heading: ref.heading,
      blockId: ref.blockId,
    },
    start: ref.start,
    end: ref.end,
  }
}

type BacklinkMatchContext = {
  normalizedDocKey: DocKey
  comparisonDocKey: DocKey
  hostHeadingCanonicals: Set<DocKey>
  linkTargetMatchMemo: Map<DocKey, boolean>
}

function refTargetsDocPanel(ref: LinkRef, ctx: BacklinkMatchContext): boolean {
  const normalizedTargetDocKey = normalizeDocKeyForNavigation(ref.targetDocKey)
  if (normalizedTargetDocKey === ctx.normalizedDocKey) return true
  const targetComparisonDocKey = normalizeDocKeyForComparison(ref.targetDocKey)
  if (targetComparisonDocKey === ctx.comparisonDocKey) return true
  if (
    ref.target.status === 'resolved' &&
    normalizeDocKeyForNavigation(ref.target.docKey) === ctx.normalizedDocKey
  ) {
    return true
  }
  const matchedByResolver =
    ctx.linkTargetMatchMemo.get(ref.targetDocKey) ??
    linkTargetMatchesDoc(ref.targetDocKey, ctx.normalizedDocKey)
  ctx.linkTargetMatchMemo.set(ref.targetDocKey, matchedByResolver)
  if (matchedByResolver) return true
  if (ctx.hostHeadingCanonicals.size === 0) return false
  return (
    ctx.hostHeadingCanonicals.has(targetComparisonDocKey) ||
    ctx.hostHeadingCanonicals.has(normalizedTargetDocKey)
  )
}

function buildEntriesFromIncomingRefs(docKey: DocKey, incoming: readonly LinkRef[]): BacklinkEntry[] {
  const normalizedDocKey = normalizeDocKeyForNavigation(docKey)
  if (!normalizedDocKey) return []
  const ctx: BacklinkMatchContext = {
    normalizedDocKey,
    comparisonDocKey: normalizeDocKeyForComparison(normalizedDocKey),
    hostHeadingCanonicals: new Set(listHeadingCanonicalsForHost(normalizedDocKey)),
    linkTargetMatchMemo: new Map(),
  }
  const bySource = new Map<DocKey, LinkRef[]>()
  for (const ref of incoming) {
    if (!refTargetsDocPanel(ref, ctx)) continue
    const list = bySource.get(ref.sourceDocKey) ?? []
    list.push(ref)
    bySource.set(ref.sourceDocKey, list)
  }

  const entries: BacklinkEntry[] = []
  for (const [sourceDocKey, refs] of bySource) {
    const sourceMeta = getDocumentMeta(sourceDocKey)
    entries.push({
      sourceDocKey,
      sourceAbsolutePath: sourceMeta?.absolutePath ?? sourceDocKey,
      sourceTitle: sourceMeta?.title ?? sourceDocKey.split('/').pop() ?? sourceDocKey,
      links: refs.map(linkRefToParsedWikiLink),
    })
  }
  return entries
}

/** Backlinks: incoming[target] ← All sources pointing to this document.*/
export function getBacklinksForDoc(docKey: DocKey): BacklinkEntry[] {
  ensureCacheFresh()
  const cached = backlinkCache.get(docKey)
  if (cached) return cached

  const incoming = getIncomingLinkRefsForDocPanel(docKey)
  const entries = buildEntriesFromIncomingRefs(docKey, incoming)

  backlinkCache.set(docKey, entries)
  return entries
}

export function rebuildBacklinksForTarget(targetDocKey: DocKey): BacklinkEntry[] {
  backlinkCache.delete(targetDocKey)
  return getBacklinksForDoc(targetDocKey)
}

export function propagateDocumentRename(fromKey: DocKey, toKey: DocKey): void {
  backlinkCache.clear()
  cacheRegistryRevision = -1
  cacheLinkGraphRevision = -1
  for (const meta of listDocumentMetas()) {
    let changed = false
    const patchLinks = (links: ParsedWikiLink[]) => {
      for (const l of links) {
        if (l.target.docKey === fromKey) {
          l.target.docKey = toKey
          changed = true
        }
      }
    }
    patchLinks(meta.links)
    patchLinks(meta.embeds)
    if (changed) rebuildBacklinksForTarget(toKey)
  }
}

export function invalidateBacklinkCache(): void {
  backlinkCache.clear()
  cacheRegistryRevision = -1
  cacheLinkGraphRevision = -1
}

export function resetBacklinkEngine(): void {
  invalidateBacklinkCache()
}
