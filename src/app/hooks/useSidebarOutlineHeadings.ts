import { useMemo, useRef, useSyncExternalStore, type MutableRefObject } from 'react'

import { getTabBody, getTabBodiesRevision, subscribeTabBodies } from '../document/tabBodiesStore'
import { getDerivedBodyForPath } from '../../documentRuntime/documentAuthority'
import { getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { getSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { parseOutlineHeadingsFromMarkdown } from '../../editor/markdownOutlineFromMarkdown'
import { pathCompareKey, pathsEqual } from '../../lib/workspacePathUtils'
import type { TocHeading } from '../components/DocumentOutlineBlock'

const MAX_OUTLINE_CACHE_ENTRIES = 32

const sharedOutlineHeadingsCache = new Map<string, TocHeading[]>()
const sharedOutlineCacheOrder: string[] = []

function outlineCacheKey(path: string): string {
  return pathCompareKey(path)
}

function getSharedOutlineCache(path: string): TocHeading[] | undefined {
  return sharedOutlineHeadingsCache.get(outlineCacheKey(path))
}

function getHookOutlineCache(
  cacheRef: MutableRefObject<Map<string, { content: string; headings: TocHeading[] }>>,
  path: string,
): { content: string; headings: TocHeading[] } | undefined {
  const key = outlineCacheKey(path)
  if (cacheRef.current.has(key)) return cacheRef.current.get(key)
  for (const [cachedPath, entry] of cacheRef.current.entries()) {
    if (pathsEqual(cachedPath, path)) return entry
  }
  return undefined
}

function rememberOutlineCache(
  cacheRef: MutableRefObject<Map<string, { content: string; headings: TocHeading[] }>>,
  orderRef: MutableRefObject<string[]>,
  path: string,
  body: string,
  headings: TocHeading[],
): void {
  const key = outlineCacheKey(path)
  cacheRef.current.set(key, { content: body, headings })
  const order = orderRef.current
  const idx = order.indexOf(key)
  if (idx >= 0) order.splice(idx, 1)
  order.push(key)
  while (order.length > MAX_OUTLINE_CACHE_ENTRIES) {
    const oldest = order.shift()
    if (oldest != null) cacheRef.current.delete(oldest)
  }

  sharedOutlineHeadingsCache.set(key, headings)
  const sharedIdx = sharedOutlineCacheOrder.indexOf(key)
  if (sharedIdx >= 0) sharedOutlineCacheOrder.splice(sharedIdx, 1)
  sharedOutlineCacheOrder.push(key)
  while (sharedOutlineCacheOrder.length > MAX_OUTLINE_CACHE_ENTRIES) {
    const oldest = sharedOutlineCacheOrder.shift()
    if (oldest != null) sharedOutlineHeadingsCache.delete(oldest)
  }
}

/** Synchronous read for outline UI fallback (same cache as the sidebar hook). */
export function getCachedSidebarOutlineHeadings(path: string): TocHeading[] | undefined {
  if (!path) return undefined
  return getSharedOutlineCache(path)
}

function resolveOutlineMarkdown(activePath: string, contentFallback: string): string {
  const tabBody = getTabBody(activePath)
  const tabBodyResolved = tabBody != null && tabBody.trim() ? tabBody : undefined

  const kernel = getDocumentRuntimeSnapshot()
  if (pathsEqual(kernel.activePath, activePath)) {
    // Prefer full on-disk markdown (YAML + body) before visual editor surface / debounced kernel body.
    const sourceIdentity = getSourceModeIdentity(activePath)
    if (sourceIdentity?.trim()) return sourceIdentity
    if (kernel.content.trim()) return kernel.content
    if (contentFallback.trim()) return contentFallback
  } else {
    const derived = getDerivedBodyForPath(activePath)
    if (derived?.trim()) return derived
  }

  if (tabBodyResolved) return tabBodyResolved

  // Tab switch in flight — never parse stale React `content` from the previous tab.
  return ''
}

/** Sidebar outline: tab-body cache + per-document heading cache (smooth tab switch). */
export function useSidebarOutlineHeadings(activePath: string, content: string): TocHeading[] {
  const cacheRef = useRef(new Map<string, { content: string; headings: TocHeading[] }>())
  const orderRef = useRef<string[]>([])
  const tabBodyRevision = useSyncExternalStore(subscribeTabBodies, getTabBodiesRevision, getTabBodiesRevision)

  return useMemo(() => {
    void tabBodyRevision
    if (!activePath) return []

    const markdown = resolveOutlineMarkdown(activePath, content)
    const cached = getHookOutlineCache(cacheRef, activePath)

    if (cached && cached.content === markdown) {
      return cached.headings
    }

    if (!markdown.trim()) {
      if (cached) return cached.headings
      return getCachedSidebarOutlineHeadings(activePath) ?? []
    }

    const headings = parseOutlineHeadingsFromMarkdown(markdown)
    rememberOutlineCache(cacheRef, orderRef, activePath, markdown, headings)
    return headings
  }, [activePath, content, tabBodyRevision])
}
