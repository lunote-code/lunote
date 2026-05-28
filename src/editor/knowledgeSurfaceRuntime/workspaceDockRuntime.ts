import {
  destroySurfaceRecord,
  getSurfaceSnapshot,
  registerSurfaceRecord,
  subscribeAllSurfaces,
  updateSurfaceMeta,
} from './surfaceLifecycle'
import type { DockRegion, DockSurfaceRegistration, SurfaceSnapshot } from './types'

type DockState = {
  left: string[]
  right: string[]
  bottom: string[]
  floating: string[]
  pinned: Set<string>
}

const docks: DockState = {
  left: [],
  right: [],
  bottom: [],
  floating: [],
  pinned: new Set(),
}

const registry = new Map<string, DockSurfaceRegistration>()
const listeners = new Set<() => void>()
let revision = 0

function bump(): void {
  revision += 1
  listeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* */
    }
  })
}

export function getDockRevision(): number {
  return revision
}

export function subscribeDockRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function registerSurface(reg: DockSurfaceRegistration): SurfaceSnapshot {
  registry.set(reg.id, reg)
  const snap = registerSurfaceRecord(reg.id, reg.kind, {
    dockRegion: reg.defaultRegion,
  })
  mountDockSurface(reg.id, reg.defaultRegion)
  if (reg.pinned) pinSurface(reg.id, true)
  return snap
}

export function mountDockSurface(surfaceId: string, region: DockRegion): void {
  detachFromAllDocks(surfaceId)
  if (region === 'floating') {
    docks.floating.push(surfaceId)
  } else {
    docks[region].push(surfaceId)
  }
  updateSurfaceMeta(surfaceId, { dockRegion: region, detached: region === 'floating' })
  bump()
}

export function moveSurfaceToDock(surfaceId: string, region: DockRegion): void {
  mountDockSurface(surfaceId, region)
}

export function detachSurface(surfaceId: string): void {
  detachFromAllDocks(surfaceId)
  docks.floating.push(surfaceId)
  updateSurfaceMeta(surfaceId, { dockRegion: 'floating', detached: true })
  bump()
}

export function pinSurface(surfaceId: string, pinned = true): void {
  if (pinned) docks.pinned.add(surfaceId)
  else docks.pinned.delete(surfaceId)
  updateSurfaceMeta(surfaceId, { pinned })
  bump()
}

export function getDockSnapshot(): Readonly<DockState> {
  return docks
}

export function listSurfacesInDock(region: DockRegion): string[] {
  if (region === 'floating') return [...docks.floating]
  return [...docks[region]]
}

function detachFromAllDocks(surfaceId: string): void {
  for (const region of ['left', 'right', 'bottom', 'floating'] as DockRegion[]) {
    const list = region === 'floating' ? docks.floating : docks[region]
    const idx = list.indexOf(surfaceId)
    if (idx >= 0) list.splice(idx, 1)
  }
}

export function unregisterDockSurface(surfaceId: string): void {
  detachFromAllDocks(surfaceId)
  docks.pinned.delete(surfaceId)
  registry.delete(surfaceId)
  destroySurfaceRecord(surfaceId)
  bump()
}

export function resetWorkspaceDockRuntime(): void {
  docks.left = []
  docks.right = []
  docks.bottom = []
  docks.floating = []
  docks.pinned.clear()
  registry.clear()
  revision = 0
}

export function subscribeDockAndSurfaces(listener: () => void): () => void {
  const u1 = subscribeDockRuntime(listener)
  const u2 = subscribeAllSurfaces(listener)
  return () => {
    u1()
    u2()
  }
}

export function getDockSurfaceSnapshot(surfaceId: string): SurfaceSnapshot | null {
  return getSurfaceSnapshot(surfaceId)
}
