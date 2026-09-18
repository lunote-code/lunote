/**
 * Tab body cache projected from the document kernel.
 * Production writes: `projectTabBodyFromKernel` / event sync, plus `setLiveTabBody` for unsynced typing.
 * Tests and QA playgrounds may call `setTabBody` to seed fixtures.
 */
import { subscribeDocumentEvents } from './documentEventStream'
import { getDocumentRuntimeSnapshot } from './documentKernel'
import { editorSurfaceForDocumentPath, warnIfFullMarkdownInBodyStore } from './documentBodyProjection'
import { pathsEqual } from '../lib/workspacePathUtils'
import { MAX_OPEN_DOCUMENT_TABS } from './openTabLimits'

/** Inactive tab bodies kept in memory (LRU); aligned with max open document tabs. */
export const MAX_TAB_BODY_CACHE_ENTRIES = MAX_OPEN_DOCUMENT_TABS

const bodies: Record<string, string> = {}
const accessOrder: string[] = []
const listeners = new Set<() => void>()
let tabBodiesRevision = 0
/** Unsynced editor body for the active path until the kernel command catches up. */
let livePath = ''
let liveBody = ''

function notifyTabBodiesListeners(): void {
  tabBodiesRevision += 1
  for (const listener of listeners) listener()
}

export function subscribeTabBodies(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getTabBodiesRevision(): number {
  return tabBodiesRevision
}

function findKey(path: string): string | undefined {
  if (!path) return undefined
  if (path in bodies) return path
  return Object.keys(bodies).find((k) => pathsEqual(k, path))
}

function peekLiveBody(path: string): string | undefined {
  if (!path || !livePath) return undefined
  return pathsEqual(livePath, path) ? liveBody : undefined
}

/** Editor typing overlay. Kernel projection clears it once the same body is committed. */
export function setLiveTabBody(path: string, body: string): void {
  if (!path) return
  if (livePath && pathsEqual(livePath, path) && liveBody === body) return
  livePath = path
  liveBody = body
  notifyTabBodiesListeners()
}

export function clearLiveTabBody(path?: string): void {
  if (!livePath) return
  if (path && !pathsEqual(livePath, path)) return
  livePath = ''
  liveBody = ''
  notifyTabBodiesListeners()
}

function clearLiveTabBodyIfMatches(path: string, body: string): void {
  if (!livePath || !path || !pathsEqual(livePath, path)) return
  if (liveBody !== body) return
  livePath = ''
  liveBody = ''
}

function touchAccess(key: string): void {
  const idx = accessOrder.indexOf(key)
  if (idx >= 0) accessOrder.splice(idx, 1)
  accessOrder.push(key)
}

function removeAccess(key: string): void {
  const idx = accessOrder.indexOf(key)
  if (idx >= 0) accessOrder.splice(idx, 1)
}

function isKernelDirtyPath(path: string): boolean {
  if (!path) return false
  const { dirtyByPath } = getDocumentRuntimeSnapshot()
  return Object.entries(dirtyByPath).some(([key, dirty]) => dirty && pathsEqual(key, path))
}

function evictIfNeeded(): void {
  while (accessOrder.length > MAX_TAB_BODY_CACHE_ENTRIES) {
    const oldestCleanIndex = accessOrder.findIndex((path) => !isKernelDirtyPath(path))
    if (oldestCleanIndex < 0) break
    const [oldest] = accessOrder.splice(oldestCleanIndex, 1)
    if (oldest != null) delete bodies[oldest]
  }
}

export function peekTabBody(path: string): string | undefined {
  const live = peekLiveBody(path)
  if (live != null) return live
  const key = findKey(path)
  if (key == null) return undefined
  return bodies[key]
}

export function getTabBody(path: string): string | undefined {
  const live = peekLiveBody(path)
  if (live != null) return live
  const key = findKey(path)
  if (key == null) return undefined
  touchAccess(key)
  return bodies[key]
}

export function setTabBody(path: string, body: string): void {
  if (!path) return
  const key = findKey(path)
  if (key != null && key !== path) {
    delete bodies[key]
    removeAccess(key)
  }
  const previous = bodies[path]
  if (previous === body) {
    touchAccess(path)
    return
  }
  bodies[path] = body
  touchAccess(path)
  evictIfNeeded()
  notifyTabBodiesListeners()
}

export function deleteTabBody(path: string): void {
  const key = findKey(path)
  if (key == null) {
    clearLiveTabBody(path)
    return
  }
  delete bodies[key]
  removeAccess(key)
  clearLiveTabBody(path)
  notifyTabBodiesListeners()
}

/** Move cached tab body when a note path changes (rename / move). */
export function renameTabBodyPath(oldPath: string, newPath: string): void {
  if (!oldPath || !newPath || pathsEqual(oldPath, newPath)) return
  const key = findKey(oldPath)
  if (key == null) return
  const body = bodies[key]
  delete bodies[key]
  removeAccess(key)
  bodies[newPath] = body
  touchAccess(newPath)
  evictIfNeeded()
  notifyTabBodiesListeners()
}

export function clearTabBodies(): void {
  for (const key of Object.keys(bodies)) delete bodies[key]
  accessOrder.length = 0
  livePath = ''
  liveBody = ''
  notifyTabBodiesListeners()
}

/** Drop cached bodies not in `keepPaths` (e.g. after closing tabs). */
export function pruneTabBodiesExcept(keepPaths: readonly string[]): void {
  const keep = new Set<string>()
  for (const path of keepPaths) {
    const key = findKey(path)
    if (key != null) keep.add(key)
  }
  for (const key of Object.keys(bodies)) {
    if (keep.has(key)) continue
    delete bodies[key]
    removeAccess(key)
  }
  notifyTabBodiesListeners()
}

export function syncTabBodyFromKernel(path: string, content: string): void {
  if (!path) return
  warnIfFullMarkdownInBodyStore('tab-body-sync', path, content)
  const surface = editorSurfaceForDocumentPath(path, content)
  setTabBody(path, surface)
  clearLiveTabBodyIfMatches(path, surface)
}

/** Synchronous kernel → tab-cache projection (preferred over waiting for the event microtask). */
export function projectTabBodyFromKernel(path: string, content: string): void {
  syncTabBodyFromKernel(path, content)
}

let syncUnsub: (() => void) | null = null

export function installTabBodiesKernelSync(): () => void {
  syncUnsub?.()
  syncUnsub = subscribeDocumentEvents((event) => {
    if (event.type === 'DocumentContentChanged' || event.type === 'DocumentSaved') {
      syncTabBodyFromKernel(event.path, event.content)
      return
    }
    if (event.type === 'DocumentOpened') {
      syncTabBodyFromKernel(event.path, event.content)
      return
    }
    if (event.type === 'WorkspaceRestored' && event.activePath) {
      const snap = getDocumentRuntimeSnapshot()
      if (pathsEqual(snap.activePath, event.activePath) && snap.content.trim()) {
        syncTabBodyFromKernel(event.activePath, snap.content)
      }
    }
  })
  return () => {
    syncUnsub?.()
    syncUnsub = null
  }
}

export function getActiveKernelContent(): string {
  return getDocumentRuntimeSnapshot().content
}

export function getTabBodyCacheSnapshot(): Readonly<Record<string, string>> {
  const snap = { ...bodies }
  if (!livePath) return snap
  for (const key of Object.keys(snap)) {
    if (pathsEqual(key, livePath)) delete snap[key]
  }
  snap[livePath] = liveBody
  return snap
}
