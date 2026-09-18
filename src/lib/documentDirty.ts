import {
  getDocumentRuntimeSnapshot,
  getDocumentSavedContent,
  isDocumentContentDirty,
} from '../documentRuntime/documentKernel'
import { getActiveKernelContent, peekTabBody } from '../app/document/tabBodiesStore'
import { pathsEqual } from './workspacePathUtils'

function hasKernelDirtyFlag(path: string): boolean {
  if (!path) return false
  const dirtyByPath = getDocumentRuntimeSnapshot().dirtyByPath
  return Object.entries(dirtyByPath).some(([key, dirty]) => dirty && pathsEqual(key, path))
}

function resolveLatestKnownContent(path: string): string | undefined {
  if (!path) return undefined
  const tabBody = peekTabBody(path)
  if (tabBody != null) return tabBody
  const snapshot = getDocumentRuntimeSnapshot()
  if (pathsEqual(snapshot.activePath, path)) {
    return getActiveKernelContent()
  }
  return undefined
}

export function isPathDirty(path: string): boolean {
  if (!path) return false
  if (hasKernelDirtyFlag(path)) return true
  if (getDocumentSavedContent(path) === undefined) return false
  const latestContent = resolveLatestKnownContent(path)
  if (latestContent == null) return false
  return isDocumentContentDirty(path, latestContent)
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
