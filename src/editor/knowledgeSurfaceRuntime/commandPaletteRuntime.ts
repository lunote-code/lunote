import { searchSemanticAsync, getRelatedNotesSync } from '../knowledgeInteractionRuntime'
import { listDocumentMetas, resolveDocKey } from '../knowledgeRuntime'
import { registerSurfaceRecord, transitionSurfacePhase } from './surfaceLifecycle'
import { scheduleSurfaceTask, cancelSurfaceTasksByPrefix } from './surfaceScheduler'
import { computeVirtualWindow, sliceVirtualItems, virtualizeSurface } from './surfaceVirtualization'
import type { CommandPaletteItem } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

export type PaletteMode = 'file' | 'command' | 'symbol' | 'tag' | 'goto'

export type CommandPaletteSnapshot = {
  surfaceId: string
  mode: PaletteMode
  query: string
  revision: number
  items: CommandPaletteItem[]
  virtualWindow: { start: number; end: number }
  visible: boolean
}

/**
 * Knowledge surface palette runtime is kept as a search scaffold only.
 * App-level command registration now lives in the main manifest/registry path.
 */
const WORKSPACE_COMMANDS: CommandPaletteItem[] = []

const snapshots = new Map<string, CommandPaletteSnapshot>()
const listeners = new Set<() => void>()
let paletteSeq = 0

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeCommandPalette(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function openCommandPalette(mode: PaletteMode = 'file'): string {
  const surfaceId = `palette-${++paletteSeq}`
  registerSurfaceRecord(surfaceId, 'command-palette')
  transitionSurfacePhase(surfaceId, 'visible')
  snapshots.set(surfaceId, {
    surfaceId,
    mode,
    query: '',
    revision: 0,
    items: [...WORKSPACE_COMMANDS],
    virtualWindow: { start: 0, end: 20 },
    visible: true,
  })
  notify()
  return surfaceId
}

export function closeCommandPalette(surfaceId: string): void {
  transitionSurfacePhase(surfaceId, 'destroyed')
  snapshots.delete(surfaceId)
  notify()
}

export function updatePaletteQuery(
  surfaceId: string,
  query: string,
  contextDocKey?: DocKey,
): void {
  const snap = snapshots.get(surfaceId)
  if (!snap) return
  cancelSurfaceTasksByPrefix(`palette:${surfaceId}`)

  snapshots.set(surfaceId, { ...snap, query, revision: snap.revision + 1 })
  notify()

  scheduleSurfaceTask({
    key: `palette:${surfaceId}:${query}`,
    kind: 'palette',
    priority: 'critical',
    run: async () => {
      const items = await rankPaletteItems(snap.mode, query, contextDocKey)
      const win = computeVirtualWindow(0, 32, 400, items.length, 10)
      virtualizeSurface(surfaceId, win)
      snapshots.set(surfaceId, {
        ...snap,
        query,
        items,
        virtualWindow: { start: win.start, end: win.end },
        revision: snap.revision + 1 + 1,
      })
      notify()
    },
  })
}

async function rankPaletteItems(
  mode: PaletteMode,
  query: string,
  contextDocKey?: DocKey,
): Promise<CommandPaletteItem[]> {
  const items: CommandPaletteItem[] = [...WORKSPACE_COMMANDS]
  const q = query.trim().toLowerCase()

  if (mode === 'file' || mode === 'goto') {
    const hits = await searchSemanticAsync(query, { limit: 40, contextDocKey })
    for (const h of hits) {
      items.push({
        id: `doc:${h.docKey}`,
        label: h.title,
        category: 'doc',
        score: h.score,
        docKey: h.docKey,
      })
    }
    if (!q) {
      for (const m of listDocumentMetas().slice(0, 20)) {
        items.push({
          id: `doc:${m.docKey}`,
          label: m.title,
          category: 'doc',
          score: 30,
          docKey: m.docKey,
        })
      }
    }
  }

  if (mode === 'tag') {
    const tags = new Set<string>()
    for (const m of listDocumentMetas()) {
      for (const t of m.outboundTags) tags.add(t)
    }
    for (const tag of tags) {
      if (q && !tag.toLowerCase().includes(q)) continue
      items.push({ id: `tag:${tag}`, label: `#${tag}`, category: 'tag', score: 50 })
    }
  }

  if (mode === 'command') {
    for (const c of WORKSPACE_COMMANDS) {
      if (!q || c.label.toLowerCase().includes(q)) items.push(c)
    }
  }

  if (contextDocKey && mode === 'file') {
    for (const r of getRelatedNotesSync(contextDocKey, 5)) {
      items.push({
        id: `rel:${r.docKey}`,
        label: r.title,
        category: 'backlink',
        score: r.score,
        docKey: r.docKey,
      })
    }
  }

  const resolved = resolveDocKey(query)
  if (resolved) {
    items.unshift({
      id: `goto:${resolved}`,
      label: `Go to ${resolved}`,
      category: 'doc',
      score: 200,
      docKey: resolved,
    })
  }

  items.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  return items.filter((i) => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
}

export function getCommandPaletteSnapshot(surfaceId: string): CommandPaletteSnapshot | null {
  return snapshots.get(surfaceId) ?? null
}

export function getVirtualizedPaletteItems(surfaceId: string): CommandPaletteItem[] {
  const snap = snapshots.get(surfaceId)
  if (!snap) return []
  const win = computeVirtualWindow(0, 32, 400, snap.items.length, 10)
  return sliceVirtualItems(snap.items, win)
}

export function handlePaletteShortcut(key: 'p' | 'shift-p' | 't' | 'o'): string {
  const mode: PaletteMode =
    key === 't' ? 'tag' : key === 'o' ? 'goto' : key === 'shift-p' ? 'command' : 'file'
  return openCommandPalette(mode)
}

export function resetCommandPaletteRuntime(): void {
  snapshots.clear()
  listeners.clear()
  paletteSeq = 0
}
