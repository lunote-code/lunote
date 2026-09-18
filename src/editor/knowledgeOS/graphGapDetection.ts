import {
  getDocumentMeta,
  getIncomingLinkRefs,
  getOutgoingLinkRefs,
  listDocumentMetas,
} from '../knowledgeRuntime'
import { getRelatedNotesSync } from '../knowledgeInteractionRuntime/knowledgeSuggestionRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

export type GraphGapKind = 'orphan' | 'underlinked' | 'shared-tag' | 'semantic'

export type GraphGapFinding = {
  id: string
  kind: GraphGapKind
  docKey: DocKey
  title: string
  peerDocKey?: DocKey
  peerTitle?: string
  score: number
}

export type GraphLinkSuggestionItem = {
  id: string
  sourceDocKey: DocKey
  targetDocKey: DocKey
  sourceTitle: string
  targetTitle: string
  reason: string
  origin: 'heuristic' | 'ai'
  confidence: number
}

export type DetectGraphGapsOptions = {
  centerDocKey: DocKey | null
  /** Limit orphan/underlinked scans to these docs when provided (current graph). */
  visibleDocKeys?: readonly DocKey[]
  /** When true, include workspace-wide orphan notes beyond the visible set. */
  includeWorkspaceOrphans?: boolean
  limit?: number
}

function noteTitle(docKey: DocKey): string {
  const meta = getDocumentMeta(docKey)
  return meta?.title?.trim() || docKey
}

function isOrphanDocument(docKey: DocKey): boolean {
  if (!getDocumentMeta(docKey)) return false
  if (getIncomingLinkRefs(docKey).length > 0) return false
  for (const ref of getOutgoingLinkRefs(docKey)) {
    if (ref.target.status !== 'resolved') continue
    const targetKey = ref.target.docKey
    if (targetKey && targetKey !== docKey) return false
  }
  return true
}

function resolvedLinkDegree(docKey: DocKey): number {
  let degree = getIncomingLinkRefs(docKey).length
  for (const ref of getOutgoingLinkRefs(docKey)) {
    if (ref.target.status === 'resolved' && ref.target.docKey && ref.target.docKey !== docKey) {
      degree += 1
    }
  }
  return degree
}

function hasDirectWikiLink(a: DocKey, b: DocKey): boolean {
  if (a === b) return true
  for (const ref of getOutgoingLinkRefs(a)) {
    if (ref.target.status === 'resolved' && ref.target.docKey === b) return true
  }
  for (const ref of getOutgoingLinkRefs(b)) {
    if (ref.target.status === 'resolved' && ref.target.docKey === a) return true
  }
  return false
}

function sharedTags(a: DocKey, b: DocKey): string[] {
  const metaA = getDocumentMeta(a)
  const metaB = getDocumentMeta(b)
  if (!metaA || !metaB) return []
  const tagsB = new Set(metaB.outboundTags)
  return metaA.outboundTags.filter((tag) => tagsB.has(tag))
}

function pushFinding(
  findings: GraphGapFinding[],
  seen: Set<string>,
  finding: Omit<GraphGapFinding, 'id'> & { id?: string },
): void {
  const id =
    finding.id ??
    `${finding.kind}:${finding.docKey}:${finding.peerDocKey ?? ''}:${finding.score.toFixed(2)}`
  if (seen.has(id)) return
  seen.add(id)
  findings.push({ ...finding, id })
}

export function detectGraphGaps(options: DetectGraphGapsOptions): GraphGapFinding[] {
  const limit = options.limit ?? 12
  const findings: GraphGapFinding[] = []
  const seen = new Set<string>()
  const center = options.centerDocKey
  const visible = options.visibleDocKeys?.length
    ? new Set(options.visibleDocKeys)
    : null

  const candidateDocKeys: DocKey[] = visible
    ? [...visible]
    : listDocumentMetas().map((meta) => meta.docKey)

  for (const docKey of candidateDocKeys) {
    if (isOrphanDocument(docKey)) {
      pushFinding(findings, seen, {
        kind: 'orphan',
        docKey,
        title: noteTitle(docKey),
        score: center && docKey === center ? 95 : 80,
      })
    }
  }

  if (options.includeWorkspaceOrphans && visible) {
    for (const meta of listDocumentMetas()) {
      if (visible.has(meta.docKey)) continue
      if (!isOrphanDocument(meta.docKey)) continue
      pushFinding(findings, seen, {
        kind: 'orphan',
        docKey: meta.docKey,
        title: meta.title,
        score: 70,
      })
    }
  }

  for (const docKey of candidateDocKeys) {
    const degree = resolvedLinkDegree(docKey)
    if (degree !== 1) continue
    pushFinding(findings, seen, {
      kind: 'underlinked',
      docKey,
      title: noteTitle(docKey),
      score: center && docKey === center ? 88 : 72,
    })
  }

  if (center) {
    const centerMeta = getDocumentMeta(center)
    const centerTags = new Set(centerMeta?.outboundTags ?? [])
    if (centerTags.size > 0) {
      for (const meta of listDocumentMetas()) {
        if (meta.docKey === center) continue
        if (visible && !visible.has(meta.docKey)) continue
        const overlap = sharedTags(center, meta.docKey)
        if (overlap.length === 0) continue
        if (hasDirectWikiLink(center, meta.docKey)) continue
        pushFinding(findings, seen, {
          kind: 'shared-tag',
          docKey: center,
          title: noteTitle(center),
          peerDocKey: meta.docKey,
          peerTitle: meta.title,
          score: 76 + overlap.length * 4,
        })
      }
    }

    for (const suggestion of getRelatedNotesSync(center, 10)) {
      if (suggestion.docKey === center) continue
      if (visible && !visible.has(suggestion.docKey)) continue
      if (hasDirectWikiLink(center, suggestion.docKey)) continue
      if (suggestion.reason === 'link' || suggestion.reason === 'graph') continue
      pushFinding(findings, seen, {
        kind: 'semantic',
        docKey: center,
        title: noteTitle(center),
        peerDocKey: suggestion.docKey,
        peerTitle: suggestion.title,
        score: suggestion.score,
      })
    }
  }

  findings.sort((a, b) => b.score - a.score)
  return findings.slice(0, limit)
}

export function graphGapsToLinkSuggestions(
  gaps: readonly GraphGapFinding[],
  options?: { origin?: 'heuristic' | 'ai'; limit?: number; centerDocKey?: DocKey | null },
): GraphLinkSuggestionItem[] {
  const origin = options?.origin ?? 'heuristic'
  const limit = options?.limit ?? 8
  const centerDocKey = options?.centerDocKey ?? null
  const suggestions: GraphLinkSuggestionItem[] = []
  const seen = new Set<string>()

  for (const gap of gaps) {
    if (gap.kind === 'orphan' && centerDocKey && gap.docKey !== centerDocKey) {
      const pairKey = `${centerDocKey}\0${gap.docKey}`
      if (seen.has(pairKey)) continue
      if (hasDirectWikiLink(centerDocKey, gap.docKey)) continue
      seen.add(pairKey)
      suggestions.push({
        id: `heuristic:${pairKey}`,
        sourceDocKey: centerDocKey,
        targetDocKey: gap.docKey,
        sourceTitle: noteTitle(centerDocKey),
        targetTitle: gap.title,
        reason: 'orphan',
        origin,
        confidence: Math.min(1, gap.score / 100),
      })
      continue
    }

    if (!gap.peerDocKey || gap.docKey === gap.peerDocKey) continue
    if (gap.kind !== 'shared-tag' && gap.kind !== 'semantic') continue
    const pairKey = `${gap.docKey}\0${gap.peerDocKey}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    suggestions.push({
      id: `heuristic:${pairKey}`,
      sourceDocKey: gap.docKey,
      targetDocKey: gap.peerDocKey,
      sourceTitle: gap.title,
      targetTitle: gap.peerTitle ?? gap.peerDocKey,
      reason:
        gap.kind === 'shared-tag'
          ? 'shared-tag'
          : gap.kind === 'semantic'
            ? 'semantic'
            : gap.kind,
      origin,
      confidence: Math.min(1, gap.score / 100),
    })
  }

  return suggestions.slice(0, limit)
}
