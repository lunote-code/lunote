import {
  getBacklinkSurfaceSync,
  loadBacklinkSurfaceAsync,
  getRelatedNotesSync,
  scheduleKnowledgeSuggestions,
  findUnlinkedMentionsIncremental,
  buildContextGraphIncremental,
} from '../knowledgeInteractionRuntime'
import { getDocumentMeta, listDocumentMetas } from '../knowledgeRuntime'
import { loadNoteContent } from '../knowledgeOS/vaultRuntime'
import { registerSurfaceRecord, transitionSurfacePhase } from './surfaceLifecycle'
import { scheduleSurfaceTask } from './surfaceScheduler'
import { computeVirtualWindow, sliceVirtualItems, virtualizeSurface } from './surfaceVirtualization'
import type { DocKey } from '../knowledgeRuntime/types'
import type { BacklinkSurfaceGroup } from '../knowledgeInteractionRuntime/types'

export type SidebarPanel = 'backlinks' | 'outgoing' | 'graph' | 'tags' | 'related' | 'mentions' | 'recent'

export type SidebarSnapshot = {
  surfaceId: string
  contextDocKey: DocKey
  revision: number
  backlinks: BacklinkSurfaceGroup[]
  outgoing: Array<{ docKey: DocKey; title: string }>
  related: ReturnType<typeof getRelatedNotesSync>
  mentions: ReturnType<typeof findUnlinkedMentionsIncremental>
  recent: Array<{ docKey: DocKey; title: string }>
  graphNodeCount: number
  virtualWindow: { start: number; end: number }
}

const snapshots = new Map<string, SidebarSnapshot>()
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeKnowledgeSidebar(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function mountKnowledgeSidebar(contextDocKey: DocKey): string {
  const surfaceId = `sidebar-${contextDocKey}`
  registerSurfaceRecord(surfaceId, 'sidebar', { docKey: contextDocKey })
  transitionSurfacePhase(surfaceId, 'visible')
  refreshSidebarAsync(surfaceId, contextDocKey)
  return surfaceId
}

export function refreshSidebarAsync(surfaceId: string, contextDocKey: DocKey, scrollTop = 0): void {
  scheduleSurfaceTask({
    key: `sidebar:${contextDocKey}`,
    kind: 'sidebar',
    priority: 'background',
    run: async () => {
      const meta = getDocumentMeta(contextDocKey)
      const backlinksSync = getBacklinkSurfaceSync(contextDocKey)
      const outgoing =
        meta?.links.map((l) => ({
          docKey: l.target.docKey,
          title: l.target.alias ?? l.target.docKey,
        })) ?? []
      const related = getRelatedNotesSync(contextDocKey)
      const recent = listDocumentMetas()
        .sort((a, b) => b.indexedAt - a.indexedAt)
        .slice(0, 12)
        .map((m) => ({ docKey: m.docKey, title: m.title }))
      const graph = buildContextGraphIncremental(contextDocKey)
      const noteContent = meta ? await loadNoteContent(contextDocKey, meta.absolutePath) : ''
      const mentions = meta
        ? findUnlinkedMentionsIncremental(contextDocKey, noteContent, meta.contentHash)
        : []

      loadBacklinkSurfaceAsync(contextDocKey, (groups) => {
        const flatCount = groups.reduce((n, g) => n + g.items.length, 0)
        const win = computeVirtualWindow(scrollTop, 48, 600, flatCount, 6)
        virtualizeSurface(surfaceId, win)

        snapshots.set(surfaceId, {
          surfaceId,
          contextDocKey,
          revision: (snapshots.get(surfaceId)?.revision ?? 0) + 1,
          backlinks: groups.length ? groups : backlinksSync,
          outgoing,
          related,
          mentions,
          recent,
          graphNodeCount: graph.nodes.length,
          virtualWindow: { start: win.start, end: win.end },
        })
        notify()
      })

      scheduleKnowledgeSuggestions(contextDocKey, meta?.title ?? '', () => notify())
    },
  })
}

export function getSidebarSnapshot(surfaceId: string): SidebarSnapshot | null {
  return snapshots.get(surfaceId) ?? null
}

export function getVirtualizedBacklinkItems(surfaceId: string): BacklinkSurfaceGroup[] {
  const snap = snapshots.get(surfaceId)
  if (!snap) return []
  const flat = snap.backlinks.flatMap((g) => g.items)
  const win = computeVirtualWindow(0, 48, 600, flat.length, 6)
  const slice = sliceVirtualItems(flat, win)
  if (!slice.length) return snap.backlinks
  return [{ id: 'virtual', label: 'Backlinks', items: slice }]
}

export function resetKnowledgeSidebarRuntime(): void {
  snapshots.clear()
  listeners.clear()
}
