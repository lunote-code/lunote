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
const inboundSnippetCacheByDoc = new Map<DocKey, Map<string, string>>()
const pendingInboundSnippetLoads = new Set<DocKey>()
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
  inboundSnippetCacheByDoc.clear()
  pendingInboundSnippetLoads.clear()
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

function inboundSnippetCacheKey(sourceDocKey: DocKey, index: number): string {
  return `${sourceDocKey}::${index}`
}

function normalizeSnippetText(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function trimSnippetAroundFocus(value: string, focus: string, maxLength = 180): string {
  if (value.length <= maxLength) return value
  const focusIndex = focus ? value.indexOf(focus) : -1
  if (focusIndex >= 0) {
    const start = Math.max(0, focusIndex - Math.floor((maxLength - focus.length) / 2))
    const end = Math.min(value.length, start + maxLength)
    return `${start > 0 ? '…' : ''}${value.slice(start, end).trim()}${end < value.length ? '…' : ''}`
  }
  return `${value.slice(0, maxLength).trim()}…`
}

function buildFallbackBacklinkSnippet(bodySample: string | undefined, raw: string): string {
  const cleaned = normalizeSnippetText(bodySample ?? '')
  if (!cleaned) return raw
  return trimSnippetAroundFocus(cleaned, raw)
}

function buildBacklinkSnippet(markdown: string, start: number, end: number, raw: string): string {
  const normalized = markdown.replace(/\r\n?/gu, '\n')
  if (!normalized.trim()) return raw
  const safeStart = Math.max(0, Math.min(start, normalized.length))
  const safeEnd = Math.max(safeStart, Math.min(end, normalized.length))
  const prevParagraphBreak = normalized.lastIndexOf('\n\n', Math.max(0, safeStart - 1))
  const nextParagraphBreak = normalized.indexOf('\n\n', safeEnd)
  const paragraphStart = prevParagraphBreak === -1 ? 0 : prevParagraphBreak + 2
  const paragraphEnd = nextParagraphBreak === -1 ? normalized.length : nextParagraphBreak
  const paragraph = normalizeSnippetText(normalized.slice(paragraphStart, paragraphEnd))
  if (!paragraph) return raw
  return trimSnippetAroundFocus(paragraph, raw)
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
  const snippetCache = inboundSnippetCacheByDoc.get(docKey)
  return getBacklinksForDoc(docKey).map((entry) => ({
    sourceDocKey: entry.sourceDocKey,
    sourceTitle: entry.sourceTitle,
    sourceAbsolutePath: entry.sourceAbsolutePath,
    items: entry.links.map((l, index) => {
      const sourceMeta = getDocumentMeta(entry.sourceDocKey)
      const snippet =
        snippetCache?.get(inboundSnippetCacheKey(entry.sourceDocKey, index)) ??
        buildFallbackBacklinkSnippet(sourceMeta?.bodySample, l.raw)
      return {
        raw: l.raw,
        snippet,
        heading: l.target.heading,
        blockId: l.target.blockId,
        range: { start: l.start, end: l.end },
      }
    }),
  }))
}

function scheduleInboundSnippetLoad(docKey: DocKey): void {
  if (pendingInboundSnippetLoads.has(docKey)) return
  const entries = getBacklinksForDoc(docKey)
  if (entries.length === 0) {
    inboundSnippetCacheByDoc.set(docKey, new Map())
    return
  }
  pendingInboundSnippetLoads.add(docKey)
  void Promise.all(
    entries.map(async (entry) => {
      const sourceMeta = getDocumentMeta(entry.sourceDocKey)
      const content = await loadNoteContent(entry.sourceDocKey, entry.sourceAbsolutePath).catch(
        () => sourceMeta?.bodySample ?? '',
      )
      return { entry, content }
    }),
  )
    .then((results) => {
      const nextCache = new Map<string, string>()
      for (const { entry, content } of results) {
        entry.links.forEach((link, index) => {
          nextCache.set(
            inboundSnippetCacheKey(entry.sourceDocKey, index),
            buildBacklinkSnippet(content, link.start, link.end, link.raw),
          )
        })
      }
      inboundSnippetCacheByDoc.set(docKey, nextCache)
      if (activePanelDocKey === docKey) {
        panelCache.delete(docKey)
        upsertPanelCache(docKey, buildPanelSnapshot(docKey))
        bumpListeners()
      }
    })
    .finally(() => {
      pendingInboundSnippetLoads.delete(docKey)
    })
}

function buildPanelSnapshot(docKey: DocKey): BacklinkPanelSnapshot {
  const linkIndexState = getLinkIndexState()
  const inboundHydrated = linkIndexState === 'READY'
  if (inboundHydrated && !inboundSnippetCacheByDoc.has(docKey)) {
    scheduleInboundSnippetLoad(docKey)
  }

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
    scheduleInboundSnippetLoad(docKey)
    scheduleMentionsLoad(docKey)
  }
  bumpListeners()
}

export function refreshBacklinkPanel(docKey?: DocKey): void {
  const key = docKey ?? activePanelDocKey
  if (!key) return
  ensureCacheCoherent()
  panelCache.delete(key)
  inboundSnippetCacheByDoc.delete(key)
  upsertPanelCache(key, buildPanelSnapshot(key))
  scheduleInboundSnippetLoad(key)
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
  inboundSnippetCacheByDoc.clear()
  pendingInboundSnippetLoads.clear()
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
