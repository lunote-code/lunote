import {
  endHoverPreview,
  getCachedPreview,
  resolvePreviewTarget,
  startHoverPreview,
  subscribeInteractionEvents,
} from '../knowledgeInteractionRuntime'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import {
  registerSurfaceRecord,
  transitionSurfacePhase,
  updateSurfaceMeta,
  getSurfaceSnapshot,
} from './surfaceLifecycle'
import { cancelSurfaceTasksByPrefix, scheduleSurfaceTask } from './surfaceScheduler'
import type { HoverPhase, HoverSurfaceSnapshot } from './types'

const HOVER_DELAY_MS = 280
const hoverSurfaces = new Map<string, HoverSurfaceSnapshot>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
let hoverSeq = 0
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeHoverSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHoverSurfaceSnapshot(id: string): HoverSurfaceSnapshot | null {
  return hoverSurfaces.get(id) ?? null
}

export function showHoverSurface(
  target: WikiLinkTarget,
  anchor: { x: number; y: number },
): string {
  const id = `hover-${++hoverSeq}`
  const resolved = resolvePreviewTarget(target)
  const base = registerSurfaceRecord(id, 'hover-card', { docKey: resolved.resolvedDocKey })
  const snap: HoverSurfaceSnapshot = {
    ...base,
    hoverPhase: 'hover-start',
    target,
    anchor,
    previewReady: false,
  }
  hoverSurfaces.set(id, snap)

  const existing = pendingTimers.get(id)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    pendingTimers.delete(id)
    transitionHoverPhase(id, 'hover-pending')
    scheduleSurfaceTask({
      key: `hover:${id}`,
      kind: 'hover',
      priority: 'interaction',
      run: () => {
        startHoverPreview(id, target)
        transitionHoverPhase(id, 'hover-visible')
        const preview = getCachedPreview(resolved)
        if (preview) {
          const s = hoverSurfaces.get(id)
          if (s) hoverSurfaces.set(id, { ...s, previewReady: true })
          notify()
        }
      },
    })
  }, HOVER_DELAY_MS)
  pendingTimers.set(id, timer)
  notify()
  return id
}

export function hideHoverSurface(id: string): void {
  const t = pendingTimers.get(id)
  if (t) {
    clearTimeout(t)
    pendingTimers.delete(id)
  }
  cancelSurfaceTasksByPrefix(`hover:${id}`)
  endHoverPreview(id)
  transitionHoverPhase(id, 'hover-hidden')
  transitionSurfacePhase(id, 'destroyed')
  hoverSurfaces.delete(id)
  notify()
}

function transitionHoverPhase(id: string, phase: HoverPhase): void {
  const s = hoverSurfaces.get(id)
  if (!s) return
  hoverSurfaces.set(id, { ...s, hoverPhase: phase })
  const base = getSurfaceSnapshot(id)
  if (base) {
    updateSurfaceMeta(id, { docKey: s.target ? resolvePreviewTarget(s.target).resolvedDocKey : null })
  }
  if (phase === 'hover-visible') transitionSurfacePhase(id, 'visible')
  notify()
}

let interactionUnsub: (() => void) | null = null

export function ensureHoverSurfaceListening(): void {
  if (interactionUnsub) return
  interactionUnsub = subscribeInteractionEvents((ev) => {
    if (ev.kind !== 'preview-ready') return
    for (const [id, snap] of hoverSurfaces) {
      if (snap.hoverPhase === 'hover-visible' || snap.hoverPhase === 'hover-pending') {
        hoverSurfaces.set(id, { ...snap, previewReady: true })
        notify()
      }
    }
  })
}

export function resetHoverSurfaceRuntime(): void {
  for (const id of [...hoverSurfaces.keys()]) hideHoverSurface(id)
  hoverSurfaces.clear()
  pendingTimers.forEach((t) => clearTimeout(t))
  pendingTimers.clear()
  listeners.clear()
  if (interactionUnsub) {
    interactionUnsub()
    interactionUnsub = null
  }
}
