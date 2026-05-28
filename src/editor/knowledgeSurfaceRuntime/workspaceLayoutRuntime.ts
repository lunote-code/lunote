import { getDockSnapshot, listSurfacesInDock } from './workspaceDockRuntime'
import type { WorkspaceLayoutSnapshot, SplitNode } from './types'

let splitTree: SplitNode | null = null
let activeSurfaceId: string | null = null
let graphViewport = { x: 0, y: 0, zoom: 1 }
let layoutRevision = 0
const listeners = new Set<() => void>()

export function getLayoutRevision(): number {
  return layoutRevision
}

export function subscribeLayoutRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function bump(): void {
  layoutRevision += 1
  listeners.forEach((fn) => fn())
}

export function setActiveSurface(surfaceId: string | null): void {
  activeSurfaceId = surfaceId
  bump()
}

export function getActiveSurfaceId(): string | null {
  return activeSurfaceId
}

export function setSplitTree(tree: SplitNode | null): void {
  splitTree = tree
  bump()
}

export function getSplitTree(): SplitNode | null {
  return splitTree
}

export function setLayoutGraphViewport(viewport: { x: number; y: number; zoom: number }): void {
  graphViewport = viewport
  bump()
}

export function serializeWorkspaceLayout(): string {
  const docks = getDockSnapshot()
  const snapshot: WorkspaceLayoutSnapshot = {
    version: 1,
    docks: {
      left: [...docks.left],
      right: [...docks.right],
      bottom: [...docks.bottom],
      floating: [...docks.floating],
    },
    floating: [...docks.floating],
    splitTree,
    activeSurfaceId,
    graphViewport,
  }
  return JSON.stringify(snapshot)
}

export function restoreWorkspaceLayout(json: string): void {
  try {
    const data = JSON.parse(json) as WorkspaceLayoutSnapshot
    if (data.version !== 1) return
    splitTree = data.splitTree
    activeSurfaceId = data.activeSurfaceId
    graphViewport = data.graphViewport ?? graphViewport
    bump()
  } catch {
    /* corrupt */
  }
}

export function getWorkspaceLayoutSnapshot(): WorkspaceLayoutSnapshot {
  const docks = getDockSnapshot()
  return {
    version: 1,
    docks: {
      left: [...docks.left],
      right: [...docks.right],
      bottom: [...docks.bottom],
      floating: [...docks.floating],
    },
    floating: [...docks.floating],
    splitTree,
    activeSurfaceId,
    graphViewport,
  }
}

export function ensureDefaultDocks(): void {
  if (!splitTree && listSurfacesInDock('left').length === 0) {
    splitTree = null
  }
  bump()
}

export function resetWorkspaceLayoutRuntime(): void {
  splitTree = null
  activeSurfaceId = null
  graphViewport = { x: 0, y: 0, zoom: 1 }
  layoutRevision = 0
  listeners.clear()
}
