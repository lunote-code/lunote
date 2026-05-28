import { emitInteractionEvent } from './interactionEvents'
import type { ContextSurfaceState, SurfaceKind } from './types'

const surfaces = new Map<string, ContextSurfaceState>()
let surfaceSeq = 0
let revision = 0

export function createContextSurface(
  kind: SurfaceKind,
  docKey?: string,
): ContextSurfaceState {
  const id = `surface-${++surfaceSeq}`
  const state: ContextSurfaceState = {
    id,
    kind,
    docKey,
    visible: false,
    hydrated: false,
    revision: 0,
  }
  surfaces.set(id, state)
  return state
}

export function getContextSurface(id: string): ContextSurfaceState | undefined {
  return surfaces.get(id)
}

export function showContextSurface(id: string): void {
  const s = surfaces.get(id)
  if (!s) return
  surfaces.set(id, { ...s, visible: true, revision: s.revision + 1 })
  revision += 1
}

export function hideContextSurface(id: string): void {
  const s = surfaces.get(id)
  if (!s) return
  surfaces.set(id, { ...s, visible: false, revision: s.revision + 1 })
  revision += 1
}

export function hydrateContextSurface(id: string): void {
  const s = surfaces.get(id)
  if (!s || s.hydrated) return
  surfaces.set(id, { ...s, hydrated: true, revision: s.revision + 1 })
  revision += 1
  emitInteractionEvent('surface-hydrated', { surfaceId: id, kind: s.kind })
}

export function listContextSurfaces(): ContextSurfaceState[] {
  return [...surfaces.values()]
}

export function getContextSurfaceRevision(): number {
  return revision
}

export function destroyContextSurface(id: string): void {
  surfaces.delete(id)
}

export function resetContextSurfaceRuntime(): void {
  surfaces.clear()
  surfaceSeq = 0
  revision = 0
}
