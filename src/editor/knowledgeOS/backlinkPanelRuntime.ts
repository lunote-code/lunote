import {
  getBacklinksForDoc,
  getDocumentMeta,
  getKnowledgeRegistryRevision,
  getLinkGraphIndexRevision,
  getLinkIndexState,
  getOutgoingLinkRefs,
  subscribeLinkIndexState,
} from '../knowledgeRuntime'
import { findUnlinkedMentionsIncremental } from '../knowledgeInteractionRuntime'
import { docKeyToDisplayTitle } from '../knowledgeRuntime/vaultRuntime'
import { loadNoteContent } from './vaultRuntime'
import { resolveWikiTarget } from './wikiLinkRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import { getPanelLayoutForType } from './surfaceLayoutRuntime'
import type { BacklinkPanelGroup, BacklinkPanelSnapshot } from './types'

type BacklinkPanelCacheEntry = {
  snapshot: BacklinkPanelSnapshot
  createdAt: number
}

const PANEL_CACHE_TTL_MS = 2000
const PANEL_CACHE_MAX_ENTRIES = 64

const panelCache = new Map<DocKey, BacklinkPanelCacheEntry>()
/** Display the previous inbound during bootstrap to avoid flashing 0 before READY*/
const lastKnownInboundByDoc = new Map<DocKey, BacklinkPanelGroup[]>()
const mentionsByDocKey = new Map<
  DocKey,
  BacklinkPanelSnapshot['mentions']
>()
let cacheRegistryRevision = -1
let cacheLinkGraphRevision = -1
let activePanelDocKey: DocKey | null = null
const listeners = new Set<() => void>()

function bumpListeners(): void {
  listeners.forEach((fn) => fn())
}

function ensureCacheCoherent(): void {
  const registryRev = getKnowledgeRegistryRevision()
  const linkGraphRev = getLinkGraphIndexRevision()
  if (cacheRegistryRevision === registryRev && cacheLinkGraphRevision === linkGraphRev) return
  cacheRegistryRevision = registryRev
  cacheLinkGraphRevision = linkGraphRev
  panelCache.clear()
}

function upsertPanelCache(key: DocKey, snapshot: BacklinkPanelSnapshot): void {
  panelCache.set(key, { snapshot, createdAt: Date.now() })
  if (panelCache.size <= PANEL_CACHE_MAX_ENTRIES) return
  const sortedKeys = [...panelCache.entries()]
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .map(([docKey]) => docKey)
  const removeCount = panelCache.size - PANEL_CACHE_MAX_ENTRIES
  for (let i = 0; i < removeCount; i += 1) {
    const oldKey = sortedKeys[i]
    if (oldKey) panelCache.delete(oldKey)
  }
}

function mapOutgoingLinkRefs(docKey: DocKey): BacklinkPanelSnapshot['outbound'] {
  return getOutgoingLinkRefs(docKey).map((ref) => {
    const resolved = resolveWikiTarget({
      docKey: ref.targetDocKey,
      heading: ref.heading,
      blockId: ref.blockId,
    })
    const targetDocKey = resolved.resolvedDocKey ?? ref.targetDocKey
    return {
      targetDocKey,
      targetTitle: docKeyToDisplayTitle(targetDocKey),
      raw: ref.raw,
      heading: resolved.rawTarget.heading ?? ref.heading,
      blockId: ref.blockId,
    }
  })
}

function mapBacklinkEntries(docKey: DocKey): BacklinkPanelGroup[] {
  return getBacklinksForDoc(docKey).map((entry) => ({
    sourceDocKey: entry.sourceDocKey,
    sourceTitle: entry.sourceTitle,
    sourceAbsolutePath: entry.sourceAbsolutePath,
    items: entry.links.map((l) => ({
      raw: l.raw,
      snippet: l.raw,
      heading: l.target.heading,
      blockId: l.target.blockId,
      range: { start: l.start, end: l.end },
    })),
  }))
}

function buildPanelSnapshot(docKey: DocKey): BacklinkPanelSnapshot {
  const linkIndexState = getLinkIndexState()
  const inboundHydrated = linkIndexState === 'READY'

  const inbound: BacklinkPanelGroup[] = inboundHydrated
    ? (() => {
        const entries = mapBacklinkEntries(docKey)
        lastKnownInboundByDoc.set(docKey, entries)
        return entries
      })()
    : (lastKnownInboundByDoc.get(docKey) ?? [])
  const outbound = inboundHydrated ? mapOutgoingLinkRefs(docKey) : []

  if (!mentionsByDocKey.has(docKey)) {
    scheduleMentionsLoad(docKey)
  }

  return {
    docKey,
    linkIndexState,
    inboundHydrated,
    inbound,
    outbound,
    mentions: mentionsByDocKey.get(docKey) ?? [],
    revision: getKnowledgeRegistryRevision(),
  }
}

function scheduleMentionsLoad(docKey: DocKey): void {
  const meta = getDocumentMeta(docKey)
  if (!meta) return
  void loadNoteContent(docKey, meta.absolutePath)
    .then((content) => {
      const source = content || meta.bodySample || ''
      const candidates = findUnlinkedMentionsIncremental(docKey, source, meta.contentHash)
      mentionsByDocKey.set(
        docKey,
        candidates.map((c) => ({
          phrase: c.phrase,
          suggestedDocKey: c.suggestedDocKey,
          suggestedTitle: c.suggestedTitle,
        })),
      )
      bumpListeners()
    })
    .catch(() => {
      mentionsByDocKey.set(docKey, [])
      bumpListeners()
    })
}

export function setBacklinkPanelDocKey(docKey: DocKey | null): void {
  activePanelDocKey = docKey
  if (docKey) {
    ensureCacheCoherent()
    upsertPanelCache(docKey, buildPanelSnapshot(docKey))
    scheduleMentionsLoad(docKey)
  }
  bumpListeners()
}

export function refreshBacklinkPanel(docKey?: DocKey): void {
  const key = docKey ?? activePanelDocKey
  if (!key) return
  ensureCacheCoherent()
  panelCache.delete(key)
  upsertPanelCache(key, buildPanelSnapshot(key))
  scheduleMentionsLoad(key)
  bumpListeners()
}

/** OKFL: backlink list viewport height driven by surface layout (not content shrink-wrap).*/
export function getBacklinkPanelLayoutHeight(): number {
  return getPanelLayoutForType('backlink').height
}

export function getBacklinkPanelSnapshot(docKey?: DocKey): BacklinkPanelSnapshot | null {
  const key = docKey ?? activePanelDocKey
  if (!key) return null
  ensureCacheCoherent()
  const cached = panelCache.get(key)
  if (cached && Date.now() - cached.createdAt <= PANEL_CACHE_TTL_MS) {
    return cached.snapshot
  }
  const snap = buildPanelSnapshot(key)
  upsertPanelCache(key, snap)
  return snap
}

export function subscribeBacklinkPanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetBacklinkPanelRuntime(): void {
  panelCache.clear()
  lastKnownInboundByDoc.clear()
  mentionsByDocKey.clear()
  cacheRegistryRevision = -1
  cacheLinkGraphRevision = -1
  activePanelDocKey = null
  listeners.clear()
}

subscribeLinkIndexState(() => {
  if (getLinkIndexState() === 'READY' && activePanelDocKey) {
    refreshBacklinkPanel(activePanelDocKey)
  } else {
    bumpListeners()
  }
})
