import { registerSurfaceRecord, transitionSurfacePhase, listSurfaceSnapshots } from './surfaceLifecycle'
import { cancelSurfaceTasksByPrefix, scheduleSurfaceTask } from './surfaceScheduler'
import type { SurfaceKind } from './types'

export type OverlayKind = 'hover' | 'popup' | 'quick-switcher' | 'context-menu' | 'graph-popup' | 'inline-preview'

export type OverlayRecord = {
  id: string
  kind: OverlayKind
  surfaceKind: SurfaceKind
  zIndex: number
  anchor: { x: number; y: number } | null
  visible: boolean
}

const overlays = new Map<string, OverlayRecord>()
let zBase = 2000
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeKnowledgeOverlay(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function mountOverlay(
  id: string,
  kind: OverlayKind,
  surfaceKind: SurfaceKind,
  anchor?: { x: number; y: number },
): OverlayRecord {
  const zIndex = ++zBase
  registerSurfaceRecord(id, surfaceKind)
  transitionSurfacePhase(id, 'visible')
  const record: OverlayRecord = {
    id,
    kind,
    surfaceKind,
    zIndex,
    anchor: anchor ?? null,
    visible: true,
  }
  overlays.set(id, record)
  notify()
  return record
}

export function hideOverlay(id: string): void {
  const o = overlays.get(id)
  if (!o) return
  overlays.set(id, { ...o, visible: false })
  transitionSurfacePhase(id, 'suspended')
  scheduleSurfaceTask({
    key: `overlay-cleanup:${id}`,
    kind: 'overlay',
    priority: 'idle',
    run: () => {
      destroyOverlay(id)
    },
  })
}

export function destroyOverlay(id: string): void {
  cancelSurfaceTasksByPrefix(`overlay:${id}`)
  overlays.delete(id)
  transitionSurfacePhase(id, 'destroyed')
  notify()
}

export function getOverlayStack(): OverlayRecord[] {
  return [...overlays.values()]
    .filter((o) => o.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function getTopOverlayZIndex(): number {
  const stack = getOverlayStack()
  return stack.length ? stack[stack.length - 1]!.zIndex : zBase
}

export function destroyAllOverlays(): void {
  for (const id of [...overlays.keys()]) destroyOverlay(id)
}

export function listActiveOverlaySurfaces(): ReturnType<typeof listSurfaceSnapshots> {
  return listSurfaceSnapshots().filter((s) => s.kind === 'overlay' || s.kind === 'hover-card')
}

export function resetKnowledgeOverlayRuntime(): void {
  destroyAllOverlays()
  overlays.clear()
  zBase = 2000
  listeners.clear()
}
