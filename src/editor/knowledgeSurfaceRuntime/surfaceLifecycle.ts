import type { SurfaceLifecyclePhase, SurfaceSnapshot, SurfaceKind, DockRegion } from './types'

type LifecycleRecord = SurfaceSnapshot & {
  listeners: Set<() => void>
}

const surfaces = new Map<string, LifecycleRecord>()
let globalRevision = 0
let zIndexSeq = 1000

const VALID_TRANSITIONS: Record<SurfaceLifecyclePhase, SurfaceLifecyclePhase[]> = {
  mount: ['visible', 'background', 'virtualized', 'suspended', 'destroyed'],
  visible: ['background', 'virtualized', 'suspended', 'destroyed'],
  background: ['visible', 'virtualized', 'suspended', 'destroyed'],
  virtualized: ['visible', 'background', 'suspended', 'destroyed'],
  suspended: ['visible', 'background', 'destroyed'],
  destroyed: [],
}

function bump(): number {
  globalRevision += 1
  return globalRevision
}

export function getSurfaceGlobalRevision(): number {
  return globalRevision
}

export function registerSurfaceRecord(
  id: string,
  kind: SurfaceKind,
  options?: { docKey?: string | null; dockRegion?: DockRegion | null },
): SurfaceSnapshot {
  const existing = surfaces.get(id)
  if (existing && existing.phase !== 'destroyed') return snapshotFrom(existing)

  const record: LifecycleRecord = {
    id,
    kind,
    phase: 'mount',
    dockRegion: options?.dockRegion ?? null,
    pinned: false,
    detached: false,
    docKey: options?.docKey ?? null,
    revision: bump(),
    zIndex: ++zIndexSeq,
    listeners: new Set(),
  }
  surfaces.set(id, record)
  notify(record)
  return snapshotFrom(record)
}

export function transitionSurfacePhase(id: string, phase: SurfaceLifecyclePhase): SurfaceSnapshot | null {
  const record = surfaces.get(id)
  if (!record || record.phase === 'destroyed') return null
  if (!VALID_TRANSITIONS[record.phase]?.includes(phase)) return snapshotFrom(record)
  record.phase = phase
  record.revision = bump()
  if (phase === 'destroyed') {
    record.listeners.clear()
    surfaces.delete(id)
  }
  notify(record)
  return snapshotFrom(record)
}

export function getSurfaceSnapshot(id: string): SurfaceSnapshot | null {
  const record = surfaces.get(id)
  if (!record || record.phase === 'destroyed') return null
  return snapshotFrom(record)
}

export function listSurfaceSnapshots(): SurfaceSnapshot[] {
  return [...surfaces.values()]
    .filter((s) => s.phase !== 'destroyed')
    .map(snapshotFrom)
}

export function updateSurfaceMeta(
  id: string,
  patch: Partial<Pick<SurfaceSnapshot, 'docKey' | 'dockRegion' | 'pinned' | 'detached'>>,
): SurfaceSnapshot | null {
  const record = surfaces.get(id)
  if (!record || record.phase === 'destroyed') return null
  Object.assign(record, patch)
  record.revision = bump()
  notify(record)
  return snapshotFrom(record)
}

export function subscribeSurface(id: string, listener: () => void): () => void {
  const record = surfaces.get(id)
  if (!record) return () => {}
  record.listeners.add(listener)
  return () => record.listeners.delete(listener)
}

export function subscribeAllSurfaces(listener: () => void): () => void {
  const wrapper = () => listener()
  for (const record of surfaces.values()) {
    record.listeners.add(wrapper)
  }
  return () => {
    for (const record of surfaces.values()) {
      record.listeners.delete(wrapper)
    }
  }
}

function snapshotFrom(record: LifecycleRecord): SurfaceSnapshot {
  return {
    id: record.id,
    kind: record.kind,
    phase: record.phase,
    dockRegion: record.dockRegion,
    pinned: record.pinned,
    detached: record.detached,
    docKey: record.docKey,
    revision: record.revision,
    zIndex: record.zIndex,
  }
}

function notify(record: LifecycleRecord): void {
  record.listeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* observer */
    }
  })
}

export function destroySurfaceRecord(id: string): void {
  transitionSurfacePhase(id, 'destroyed')
}

export function resetSurfaceLifecycle(): void {
  for (const id of [...surfaces.keys()]) {
    transitionSurfacePhase(id, 'destroyed')
  }
  surfaces.clear()
  globalRevision = 0
  zIndexSeq = 1000
}
