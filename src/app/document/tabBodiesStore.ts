/**
 * Tab body cache synchronized with document kernel (single write source).
 * It is prohibited to directly modify internal objects; they must be read and written through the API of this module.
 */
import { subscribeDocumentEvents } from '../../documentRuntime/documentEventStream'
import { getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { MAX_OPEN_DOCUMENT_TABS } from './openTabLimits'

/** Inactive tab bodies kept in memory (LRU); aligned with max open document tabs. */
export const MAX_TAB_BODY_CACHE_ENTRIES = MAX_OPEN_DOCUMENT_TABS

const bodies: Record<string, string> = {}
const accessOrder: string[] = []
const listeners = new Set<() => void>()
let tabBodiesRevision = 0

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

function touchAccess(key: string): void {
  const idx = accessOrder.indexOf(key)
  if (idx >= 0) accessOrder.splice(idx, 1)
  accessOrder.push(key)
}

function removeAccess(key: string): void {
  const idx = accessOrder.indexOf(key)
  if (idx >= 0) accessOrder.splice(idx, 1)
}

function evictIfNeeded(): void {
  while (accessOrder.length > MAX_TAB_BODY_CACHE_ENTRIES) {
    const oldest = accessOrder.shift()
    if (oldest != null) delete bodies[oldest]
  }
}

export function getTabBody(path: string): string | undefined {
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
  if (key == null) return
  delete bodies[key]
  removeAccess(key)
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
  setTabBody(path, content)
}

let syncInstalled = false

export function installTabBodiesKernelSync(): () => void {
  if (syncInstalled) return () => undefined
  syncInstalled = true

  return subscribeDocumentEvents((event) => {
    if (event.type === 'DocumentContentChanged' || event.type === 'DocumentSaved') {
      syncTabBodyFromKernel(event.path, event.content)
      return
    }
    if (event.type === 'DocumentOpened') {
      syncTabBodyFromKernel(event.path, event.content)
    }
  })
}

export function getActiveKernelContent(): string {
  return getDocumentRuntimeSnapshot().content
}

export function getTabBodyCacheSnapshot(): Readonly<Record<string, string>> {
  return { ...bodies }
}
