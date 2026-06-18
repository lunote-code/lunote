import { listDocumentMetas } from './knowledgeRegistry'
import { listHeadingCanonicalsForHost } from './headingLinkTargets'
import { resolveHeadingTarget } from './headingLinkTargets'
import {
  canonicalDocKeyForGraph,
  canonicalizeWikiLinkText,
  linkTargetMatchesDoc as wikiTargetMatchesDoc,
  resolveWikiLinkTarget,
  resolveWikiLinkTargetDocKey,
} from './wikiLinkResolver'
import {
  normalizeDocKeyForComparison,
  normalizeDocKeyForNavigation,
} from './docKeyNormalization'
import { wikiLinkInnerTargetText } from './wikiLinkParser'
import type { CanonicalDocumentTarget, DocKey, ParsedWikiLink, WikiLinkKind } from './types'

/** Parsed wiki link edges (common for outgoing / incoming).*/
export type LinkRef = {
  sourceDocKey: DocKey
  targetDocKey: DocKey
  target: CanonicalDocumentTarget
  heading?: string
  blockId?: string
  kind: WikiLinkKind
  start: number
  end: number
  raw: string
}

type DocumentLinkIndex = {
  outgoingBySource: Map<DocKey, LinkRef[]>
  incomingByTarget: Map<DocKey, LinkRef[]>
  outgoingKeysBySource: Map<DocKey, Set<string>>
  incomingKeysByTarget: Map<DocKey, Set<string>>
}

const linkIndex: DocumentLinkIndex = {
  outgoingBySource: new Map(),
  incomingByTarget: new Map(),
  outgoingKeysBySource: new Map(),
  incomingKeysByTarget: new Map(),
}

const EMPTY_LINK_REFS: readonly LinkRef[] = Object.freeze([])
let linkGraphIndexRevision = 0

function markLinkGraphIndexMutated(): void {
  linkGraphIndexRevision += 1
}

function linkRefKey(ref: LinkRef): string {
  return `${ref.sourceDocKey}|${ref.targetDocKey}|${ref.start}|${ref.end}|${ref.raw}`
}

function incomingKeysForTarget(docKey: DocKey): DocKey[] {
  const keys = new Set<DocKey>()
  const normalized = normalizeDocKeyForNavigation(docKey)
  const canonical = canonicalDocKeyForGraph(normalized)
  if (canonical) keys.add(canonical)
  if (normalized) keys.add(normalized)
  const slug = canonicalizeWikiLinkText(normalized)
  if (slug) keys.add(slug)
  const comparison = normalizeDocKeyForComparison(normalized)
  if (comparison) keys.add(comparison)
  return [...keys]
}

function incomingTargetKey(targetDocKey: DocKey): DocKey {
  const normalized = normalizeDocKeyForNavigation(targetDocKey)
  return normalizeDocKeyForComparison(normalized) || normalized || targetDocKey
}

/** linkGraph incoming link Map key: consistent with incoming index normalization.*/
export function linkIncomingStorageKey(targetDocKey: DocKey): DocKey {
  return incomingTargetKey(targetDocKey)
}

/** linkGraph is the set of keys merged when querying incoming edges.*/
export function linkIncomingLookupKeys(docKey: DocKey): DocKey[] {
  return incomingKeysForTarget(docKey)
}

/**
 * Reparse wiki links for all indexed documents using the current registry (fix unresolved freezes caused by indexing order).
 */
export function refreshAllLinkRefsFromRegistry(): void {
  for (const meta of listDocumentMetas()) {
    const linkRefs = linkRefsFromParsedWikiLinks(meta.docKey, [...meta.links, ...meta.embeds])
    rebuildLinkGraphIndexForDocument(meta.docKey, linkRefs)
  }
  markLinkGraphIndexMutated()
}

function logIncomingBuild(source: DocKey, target: DocKey): void {
  if (!import.meta.env.DEV) return
  const canonicalTarget = canonicalDocKeyForGraph(target)
  const refs = linkIndex.incomingByTarget.get(canonicalTarget) ?? []
  console.debug('[IncomingBuild]', {
    source,
    target: canonicalTarget,
    incomingCount: refs.length,
  })
}

function logIncomingState(target: DocKey): void {
  if (!import.meta.env.DEV) return
  const canonicalTarget = canonicalDocKeyForGraph(target)
  console.debug('[IncomingState]', {
    target: canonicalTarget,
    refs: linkIndex.incomingByTarget.get(canonicalTarget) ?? [],
  })
}

/** @deprecated using resolveWikiLinkTarget*/
export function resolveLinkTargetDocKey(rawTarget: string): DocKey | null {
  return resolveWikiLinkTargetDocKey(rawTarget)
}

export function linkTargetMatchesDoc(linkTargetDocKey: DocKey, docKey: DocKey): boolean {
  return wikiTargetMatchesDoc(linkTargetDocKey, docKey)
}

export function linkRefsFromParsedWikiLinks(
  sourceDocKey: DocKey,
  links: readonly ParsedWikiLink[],
): LinkRef[] {
  const refs: LinkRef[] = []
  for (const l of links) {
    const implicitHeadingTarget =
      !l.target.heading && !l.target.blockId
        ? resolveHeadingTarget(l.target.docKey)
        : null
    const resolvedTarget = resolveWikiLinkTarget(l.target.docKey)
    const canonicalTarget = canonicalizeWikiLinkText(l.target.docKey)
    const displayTarget =
      l.target.alias?.trim() || wikiLinkInnerTargetText(l.raw, l.target.docKey)
    const target: CanonicalDocumentTarget = {
      ...resolvedTarget,
      anchor: {
        headingSlug: l.target.heading ? canonicalizeWikiLinkText(l.target.heading) : undefined,
        blockId: l.target.blockId,
      },
      raw: displayTarget,
      canonical: canonicalTarget,
      label: displayTarget,
    }
    refs.push({
      sourceDocKey,
      targetDocKey: target.docKey,
      target,
      heading: l.target.heading ?? implicitHeadingTarget?.heading,
      blockId: l.target.blockId,
      kind: l.kind,
      start: l.start,
      end: l.end,
      raw: l.raw,
    })
  }
  return refs
}

/** Removes the specified refs from incoming[target] only (no other sources are touched).*/
function removeRefsFromIncomingTargets(refs: readonly LinkRef[]): void {
  const byTarget = new Map<DocKey, Set<string>>()
  for (const ref of refs) {
    const target = incomingTargetKey(ref.targetDocKey)
    const keys = byTarget.get(target) ?? new Set()
    keys.add(linkRefKey(ref))
    byTarget.set(target, keys)
  }

  for (const [target, removeKeys] of byTarget) {
    const list = linkIndex.incomingByTarget.get(target)
    if (!list?.length) continue
    const next = list.filter((r) => !removeKeys.has(linkRefKey(r)))
    if (next.length > 0) {
      linkIndex.incomingByTarget.set(target, next)
      linkIndex.incomingKeysByTarget.set(target, new Set(next.map(linkRefKey)))
    } else {
      linkIndex.incomingByTarget.delete(target)
      linkIndex.incomingKeysByTarget.delete(target)
    }
  }
}

/** Delete all old outgoings of the source and remove them from the incoming of each target simultaneously.*/
function removePreviousOutgoingEdges(sourceDocKey: DocKey): void {
  const prev = linkIndex.outgoingBySource.get(sourceDocKey) ?? []
  if (!prev.length) {
    linkIndex.outgoingBySource.delete(sourceDocKey)
    return
  }
  removeRefsFromIncomingTargets(prev)
  linkIndex.outgoingBySource.delete(sourceDocKey)
  linkIndex.outgoingKeysBySource.delete(sourceDocKey)
}

function appendIncomingRef(ref: LinkRef): void {
  const target = incomingTargetKey(ref.targetDocKey)
  const key = linkRefKey(ref)
  const keySet = linkIndex.incomingKeysByTarget.get(target) ?? new Set<string>()
  if (keySet.has(key)) return
  const existing = linkIndex.incomingByTarget.get(target)
  if (existing) existing.push(ref)
  else linkIndex.incomingByTarget.set(target, [ref])
  keySet.add(key)
  linkIndex.incomingKeysByTarget.set(target, keySet)
  logIncomingBuild(ref.sourceDocKey, target)
}

function appendOutgoingRef(ref: LinkRef): void {
  const key = linkRefKey(ref)
  const keySet = linkIndex.outgoingKeysBySource.get(ref.sourceDocKey) ?? new Set<string>()
  if (keySet.has(key)) return
  const existing = linkIndex.outgoingBySource.get(ref.sourceDocKey)
  if (existing) existing.push(ref)
  else linkIndex.outgoingBySource.set(ref.sourceDocKey, [ref])
  keySet.add(key)
  linkIndex.outgoingKeysBySource.set(ref.sourceDocKey, keySet)
  appendIncomingRef(ref)
}

/**
 * Incremental rebuild: Only updates outgoing[source] and the incoming edges pointed to by source.
 * Disable incoming.clear() or full image reconstruction.
 */
export function rebuildLinkGraphIndexForDocument(
  sourceDocKey: DocKey,
  refs: readonly LinkRef[],
): void {
  removePreviousOutgoingEdges(sourceDocKey)

  for (const ref of refs) {
    appendOutgoingRef(ref)
  }
  markLinkGraphIndexMutated()

  if (import.meta.env.DEV) {
    for (const target of new Set(refs.map((r) => r.targetDocKey))) {
      logIncomingState(target)
    }
    console.debug('[LinkGraphIndex]', {
      docKey: sourceDocKey,
      outgoing: getOutgoingLinkRefs(sourceDocKey).length,
    })
  }
}

/**
 * Full verification: rebuild incoming by outgoing (only called after bootstrap / cache restore).
 */
export function rebuildIncomingFromOutgoing(): void {
  linkIndex.incomingByTarget.clear()
  linkIndex.incomingKeysByTarget.clear()
  for (const refs of linkIndex.outgoingBySource.values()) {
    for (const ref of refs) {
      appendIncomingRef(ref)
    }
  }
  markLinkGraphIndexMutated()
}

export function getOutgoingLinkRefs(docKey: DocKey): readonly LinkRef[] {
  return [...(linkIndex.outgoingBySource.get(docKey) ?? EMPTY_LINK_REFS)]
}

export function getOutgoingLinkRefsReadonly(docKey: DocKey): readonly LinkRef[] {
  return linkIndex.outgoingBySource.get(docKey) ?? EMPTY_LINK_REFS
}

function mergeIncomingFromKeys(keys: readonly DocKey[]): LinkRef[] {
  const seen = new Set<string>()
  const merged: LinkRef[] = []
  for (const key of keys) {
    for (const ref of linkIndex.incomingByTarget.get(key) ?? []) {
      const k = linkRefKey(ref)
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(ref)
    }
  }
  return merged
}

export function getIncomingLinkRefs(docKey: DocKey): readonly LinkRef[] {
  const merged = mergeIncomingFromKeys(incomingKeysForTarget(docKey))
  return merged
}

/** Panel use: file level + in-text title level incoming (single document multi-chapter vault).*/
export function getIncomingLinkRefsForDocPanel(docKey: DocKey): readonly LinkRef[] {
  const keys = new Set<DocKey>([...incomingKeysForTarget(docKey), ...listHeadingCanonicalsForHost(docKey)])
  return mergeIncomingFromKeys([...keys])
}

export function getIncomingLinkCount(docKey: DocKey): number {
  return getIncomingLinkRefs(docKey).length
}

export function removeLinkGraphIndexForDocument(docKey: DocKey): void {
  removePreviousOutgoingEdges(docKey)
  for (const key of incomingKeysForTarget(docKey)) {
    linkIndex.incomingByTarget.delete(key)
    linkIndex.incomingKeysByTarget.delete(key)
  }
  markLinkGraphIndexMutated()
}

export function resetLinkGraphIndex(): void {
  linkIndex.outgoingBySource.clear()
  linkIndex.incomingByTarget.clear()
  linkIndex.outgoingKeysBySource.clear()
  linkIndex.incomingKeysByTarget.clear()
  markLinkGraphIndexMutated()
}

export function listOutgoingDocKeys(): DocKey[] {
  return [...linkIndex.outgoingBySource.keys()]
}

export function getLinkGraphEdgeCounts(): { outgoingEdges: number; incomingEdges: number } {
  let outgoingEdges = 0
  let incomingEdges = 0
  for (const refs of linkIndex.outgoingBySource.values()) outgoingEdges += refs.length
  for (const refs of linkIndex.incomingByTarget.values()) incomingEdges += refs.length
  return { outgoingEdges, incomingEdges }
}

export type LinkGraphIndexInvariantReport = {
  ok: boolean
  outgoingEdges: number
  incomingEdges: number
  missingIncomingRefs: number
  danglingIncomingRefs: number
  fragmentedTargetKeySlots: number
}

/**
 * Index invariants: incoming should be symmetrical with outgoing; the same logical target should not be excessively fragmented by multiple key slots.
 */
export function checkLinkGraphIndexInvariants(): LinkGraphIndexInvariantReport {
  const outgoingRefKeys = new Set<string>()
  const incomingRefKeys = new Set<string>()
  const canonicalTargetKeySlots = new Map<string, Set<DocKey>>()
  let outgoingEdges = 0
  let incomingEdges = 0

  for (const refs of linkIndex.outgoingBySource.values()) {
    outgoingEdges += refs.length
    for (const ref of refs) {
      outgoingRefKeys.add(linkRefKey(ref))
    }
  }

  for (const [targetKey, refs] of linkIndex.incomingByTarget.entries()) {
    incomingEdges += refs.length
    const canonical = normalizeDocKeyForComparison(targetKey)
    const slots = canonicalTargetKeySlots.get(canonical) ?? new Set<DocKey>()
    slots.add(targetKey)
    canonicalTargetKeySlots.set(canonical, slots)
    for (const ref of refs) {
      incomingRefKeys.add(linkRefKey(ref))
    }
  }

  let missingIncomingRefs = 0
  for (const key of outgoingRefKeys) {
    if (!incomingRefKeys.has(key)) missingIncomingRefs += 1
  }

  let danglingIncomingRefs = 0
  for (const key of incomingRefKeys) {
    if (!outgoingRefKeys.has(key)) danglingIncomingRefs += 1
  }

  let fragmentedTargetKeySlots = 0
  for (const slots of canonicalTargetKeySlots.values()) {
    if (slots.size > 1) fragmentedTargetKeySlots += 1
  }

  return {
    ok: missingIncomingRefs === 0 && danglingIncomingRefs === 0,
    outgoingEdges,
    incomingEdges,
    missingIncomingRefs,
    danglingIncomingRefs,
    fragmentedTargetKeySlots,
  }
}

export function exportLinkGraphIndexSnapshot(): {
  outgoing: Record<string, LinkRef[]>
  incoming: Record<string, LinkRef[]>
} {
  const outgoing: Record<string, LinkRef[]> = {}
  const incoming: Record<string, LinkRef[]> = {}
  for (const [k, refs] of linkIndex.outgoingBySource) outgoing[k] = [...refs]
  for (const [k, refs] of linkIndex.incomingByTarget) incoming[k] = [...refs]
  return { outgoing, incoming }
}

/**
 * Only the full outgoing is restored; incoming is always derived from the full outgoing (disables trusting cached incoming).
 * Note: scanAllDocuments is still required to open the workspace, and snapshot cannot be used as the only data source.
 */
export function restoreLinkGraphIndexSnapshot(
  outgoing: Record<string, LinkRef[]>,
  _incoming?: Record<string, LinkRef[]>,
): void {
  linkIndex.outgoingBySource.clear()
  linkIndex.incomingByTarget.clear()
  linkIndex.outgoingKeysBySource.clear()
  linkIndex.incomingKeysByTarget.clear()
  for (const [k, refs] of Object.entries(outgoing)) {
    if (!refs.length) continue
    const copied = [...refs]
    linkIndex.outgoingBySource.set(k, copied)
    linkIndex.outgoingKeysBySource.set(k, new Set(copied.map(linkRefKey)))
  }
  rebuildIncomingFromOutgoing()
}

export function getLinkGraphIndexRevision(): number {
  return linkGraphIndexRevision
}
