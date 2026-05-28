import {
  closePeek,
  cmdClickWikiLink,
  getPeekPreview,
  openPeek,
  peekDefinition,
  peekReferences,
  type PeekState,
} from '../knowledgeInteractionRuntime'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import {
  registerSurfaceRecord,
  transitionSurfacePhase,
  updateSurfaceMeta,
} from './surfaceLifecycle'
import { scheduleSurfaceTask } from './surfaceScheduler'
import type { SurfaceSnapshot } from './types'

export type PeekSurfaceMode = 'inline' | 'overlay'

export type PeekSurfaceSnapshot = SurfaceSnapshot & {
  peekId: string
  mode: PeekSurfaceMode
  kirState: PeekState | null
  hydrated: boolean
}

const peeks = new Map<string, PeekSurfaceSnapshot>()
const listeners = new Set<() => void>()
let peekSeq = 0

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribePeekSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function openPeekSurface(
  target: WikiLinkTarget,
  options?: { kind?: 'definition' | 'reference' | 'backlink'; mode?: PeekSurfaceMode; sourceDocKey?: string },
): string | null {
  const mode = options?.mode ?? 'overlay'
  const kind = options?.kind ?? 'definition'
  const kir =
    kind === 'reference'
      ? peekReferences(target, options?.sourceDocKey)
      : kind === 'backlink'
        ? openPeek({ kind: 'backlink', target, sourceDocKey: options?.sourceDocKey })
        : peekDefinition(target)
  if (!kir) return null

  const surfaceId = `peek-surface-${++peekSeq}`
  const base = registerSurfaceRecord(surfaceId, mode === 'inline' ? 'peek-inline' : 'peek-overlay', {
    docKey: kir.navigation?.docKey ?? kir.target.resolvedDocKey ?? target.docKey,
  })
  transitionSurfacePhase(surfaceId, 'visible')

  const snap: PeekSurfaceSnapshot = {
    ...base,
    peekId: kir.id,
    mode,
    kirState: kir,
    hydrated: false,
  }
  peeks.set(surfaceId, snap)

  scheduleSurfaceTask({
    key: `peek:${surfaceId}`,
    kind: 'preview',
    priority: 'critical',
    run: () => {
      const preview = getPeekPreview(kir.id)
      const s = peeks.get(surfaceId)
      if (s) {
        peeks.set(surfaceId, { ...s, hydrated: !!preview })
        updateSurfaceMeta(surfaceId, { docKey: s.docKey })
        notify()
      }
    },
  })
  notify()
  return surfaceId
}

export function closePeekSurface(surfaceId: string): void {
  const snap = peeks.get(surfaceId)
  if (!snap) return
  closePeek(snap.peekId)
  transitionSurfacePhase(surfaceId, 'destroyed')
  peeks.delete(surfaceId)
  notify()
}

export function getPeekSurfaceSnapshot(surfaceId: string): PeekSurfaceSnapshot | null {
  return peeks.get(surfaceId) ?? null
}

export function handleWikiCmdClick(
  target: WikiLinkTarget,
  modifiers?: { altKey?: boolean; metaKey?: boolean },
): { action: 'navigate' | 'peek'; surfaceId?: string } {
  const result = cmdClickWikiLink(target, modifiers)
  if (result.action === 'peek' && result.peek) {
    const surfaceId = openPeekSurface(target, { mode: 'overlay' })
    return { action: 'peek', surfaceId: surfaceId ?? undefined }
  }
  return { action: 'navigate' }
}

export function resetPeekSurfaceRuntime(): void {
  for (const id of [...peeks.keys()]) closePeekSurface(id)
  peeks.clear()
  listeners.clear()
}
