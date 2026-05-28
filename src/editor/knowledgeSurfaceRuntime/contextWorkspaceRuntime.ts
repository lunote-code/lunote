import { initKnowledgeInteractionRuntime } from '../knowledgeInteractionRuntime'
import { registerSurface } from './workspaceDockRuntime'
import { ensureDefaultDocks, getWorkspaceLayoutSnapshot } from './workspaceLayoutRuntime'
import { ensureHoverSurfaceListening } from './hoverSurfaceRuntime'
import { getSurfaceGlobalRevision, subscribeAllSurfaces } from './surfaceLifecycle'
import { getDockRevision, subscribeDockRuntime } from './workspaceDockRuntime'

export type ContextWorkspaceSnapshot = {
  revision: number
  surfaceRevision: number
  dockRevision: number
  layout: ReturnType<typeof getWorkspaceLayoutSnapshot>
}

let initialized = false
let revision = 0
const listeners = new Set<() => void>()

function bump(): void {
  revision += 1
  listeners.forEach((fn) => fn())
}

export function getContextWorkspaceRevision(): number {
  return revision
}

export function subscribeContextWorkspace(listener: () => void): () => void {
  listeners.add(listener)
  const u1 = subscribeAllSurfaces(listener)
  const u2 = subscribeDockRuntime(listener)
  return () => {
    listeners.delete(listener)
    u1()
    u2()
  }
}

export function getContextWorkspaceSnapshot(): ContextWorkspaceSnapshot {
  return {
    revision,
    surfaceRevision: getSurfaceGlobalRevision(),
    dockRevision: getDockRevision(),
    layout: getWorkspaceLayoutSnapshot(),
  }
}

/** Initialize IDE knowledge workspace (dock + KIR listening)*/
export function initContextWorkspace(): void {
  if (initialized) return
  initKnowledgeInteractionRuntime()
  ensureHoverSurfaceListening()

  registerSurface({
    id: 'dock-backlinks',
    kind: 'backlinks-panel',
    defaultRegion: 'right',
    pinned: true,
  })
  registerSurface({
    id: 'dock-graph',
    kind: 'graph-panel',
    defaultRegion: 'right',
  })
  registerSurface({
    id: 'dock-search',
    kind: 'search-panel',
    defaultRegion: 'bottom',
  })

  ensureDefaultDocks()
  initialized = true
  bump()
}

export function notifyContextWorkspaceChanged(): void {
  bump()
}

export function resetContextWorkspaceRuntime(): void {
  initialized = false
  revision = 0
  listeners.clear()
}
