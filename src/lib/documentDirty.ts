import { getDocumentRuntimeSnapshot } from '../documentRuntime/documentKernel'
import { pathsEqual } from './workspacePathUtils'

export function isPathDirty(path: string): boolean {
  if (!path) return false
  const dirtyByPath = getDocumentRuntimeSnapshot().dirtyByPath
  return Object.entries(dirtyByPath).some(([key, dirty]) => dirty && pathsEqual(key, path))
}

export function hasAnyDirtyDocument(): boolean {
  const snap = getDocumentRuntimeSnapshot()
  const paths = new Set([
    ...snap.openedTabs,
    snap.activePath,
    ...Object.keys(snap.dirtyByPath),
  ].filter(Boolean))
  for (const path of paths) {
    if (isPathDirty(path)) return true
  }
  return false
}

export function listDirtyDocumentPaths(): string[] {
  const snap = getDocumentRuntimeSnapshot()
  const paths = new Set([
    ...snap.openedTabs,
    snap.activePath,
    ...Object.keys(snap.dirtyByPath),
  ].filter(Boolean))
  return [...paths].filter((path) => isPathDirty(path))
}
