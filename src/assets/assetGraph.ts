import { invoke } from '@tauri-apps/api/core'
import { pathCompareKey } from '../lib/workspacePathUtils'
import { readDocument } from '../io/documentIO'
import {
  getActiveAssetWorkspace,
  readWorkspaceAssetIndex,
  updateAssetReferenceStats,
} from './workspaceAssetStore'

export type AssetGraphNode = {
  assetId: string
  referredByNotes: string[]
  outgoingRefs: string[]
  lastAccessedAt: number
}

export type AssetGraphSnapshot = {
  nodes: Record<string, AssetGraphNode>
  documents: Record<string, string[]>
}

const LUNA_ASSET_REF_RE = /luna-asset:\/\/([A-Za-z0-9_-]+)/gu

const nodes = new Map<string, AssetGraphNode>()
const documentRefs = new Map<string, Set<string>>()

export function extractAssetIdsFromMarkdown(markdown: string): string[] {
  const ids = new Set<string>()
  for (const match of markdown.matchAll(LUNA_ASSET_REF_RE)) {
    const id = match[1]?.trim()
    if (id) ids.add(id)
  }
  return [...ids]
}

export function updateDocumentAssetReferences(
  docPath: string,
  assetIds: readonly string[],
): void {
  const normalizedDoc = normalizeDocPath(docPath)
  const uniqueIds = new Set(assetIds.filter(Boolean))
  const previous = documentRefs.get(normalizedDoc) ?? new Set<string>()
  const now = Date.now()

  for (const assetId of previous) {
    if (!uniqueIds.has(assetId)) {
      const node = nodes.get(assetId)
      if (node) {
        node.referredByNotes = node.referredByNotes.filter((path) => path !== normalizedDoc)
      }
    }
  }

  documentRefs.set(normalizedDoc, uniqueIds)
  for (const assetId of uniqueIds) {
    const node = nodes.get(assetId) ?? {
      assetId,
      referredByNotes: [],
      outgoingRefs: [],
      lastAccessedAt: now,
    }
    if (!node.referredByNotes.includes(normalizedDoc)) {
      node.referredByNotes.push(normalizedDoc)
    }
    node.lastAccessedAt = now
    nodes.set(assetId, node)
  }
}

export function getAssetsByDocument(docPath: string): string[] {
  return [...(documentRefs.get(normalizeDocPath(docPath)) ?? [])]
}

export function getDocumentsByAsset(assetId: string): string[] {
  return [...(nodes.get(assetId)?.referredByNotes ?? [])]
}

export function getAssetGraphNode(assetId: string): AssetGraphNode | null {
  const node = nodes.get(assetId)
  return node ? { ...node, referredByNotes: [...node.referredByNotes], outgoingRefs: [...node.outgoingRefs] } : null
}

export function getAssetGraphSnapshot(): AssetGraphSnapshot {
  const snapshotNodes: Record<string, AssetGraphNode> = {}
  const documents: Record<string, string[]> = {}
  for (const [assetId, node] of nodes) {
    snapshotNodes[assetId] = {
      ...node,
      referredByNotes: [...node.referredByNotes],
      outgoingRefs: [...node.outgoingRefs],
    }
  }
  for (const [docPath, refs] of documentRefs) {
    documents[docPath] = [...refs]
  }
  return { nodes: snapshotNodes, documents }
}

export async function buildAssetGraphFromWorkspace(params: {
  root: string
  workspaceId?: string
}): Promise<AssetGraphSnapshot> {
  const workspaceId = params.workspaceId ?? getActiveAssetWorkspace()
  nodes.clear()
  documentRefs.clear()
  const docs = await invoke<string[]>('list_markdown_files', {
    payload: { root: params.root },
  })
  await Promise.all(docs.map(async (docPath) => {
    const content = await readDocument(params.root, docPath)
    updateDocumentAssetReferences(docPath, extractAssetIdsFromMarkdown(content))
  }))
  await syncAssetGraphStatsToIndex(workspaceId)
  return getAssetGraphSnapshot()
}

export async function syncAssetGraphStatsToIndex(
  workspaceId = getActiveAssetWorkspace(),
): Promise<void> {
  const index = await readWorkspaceAssetIndex(workspaceId)
  const stats: Record<string, { referenceCount: number; lastReferencedAt?: number }> = {}
  for (const assetId of Object.keys(index.assets)) {
    const node = nodes.get(assetId)
    stats[assetId] = {
      referenceCount: node?.referredByNotes.length ?? 0,
      lastReferencedAt: node?.lastAccessedAt,
    }
  }
  await updateAssetReferenceStats(stats, workspaceId)
}

export function resetAssetGraph(): void {
  nodes.clear()
  documentRefs.clear()
}

function normalizeDocPath(docPath: string): string {
  return pathCompareKey(docPath)
}
