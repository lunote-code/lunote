import { useMemo, useRef, type MutableRefObject } from 'react'

import { getTabBody } from '../document/tabBodiesStore'
import { getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { parseOutlineHeadingsFromMarkdown } from '../../editor/markdownOutlineFromMarkdown'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { TocHeading } from '../components/DocumentOutlineBlock'

const MAX_OUTLINE_CACHE_ENTRIES = 32

const sharedOutlineHeadingsCache = new Map<string, TocHeading[]>()
const sharedOutlineCacheOrder: string[] = []

function rememberOutlineCache(
  cacheRef: MutableRefObject<Map<string, { content: string; headings: TocHeading[] }>>,
  orderRef: MutableRefObject<string[]>,
  path: string,
  body: string,
  headings: TocHeading[],
): void {
  cacheRef.current.set(path, { content: body, headings })
  const order = orderRef.current
  const idx = order.indexOf(path)
  if (idx >= 0) order.splice(idx, 1)
  order.push(path)
  while (order.length > MAX_OUTLINE_CACHE_ENTRIES) {
    const oldest = order.shift()
    if (oldest != null) cacheRef.current.delete(oldest)
  }

  sharedOutlineHeadingsCache.set(path, headings)
  const sharedIdx = sharedOutlineCacheOrder.indexOf(path)
  if (sharedIdx >= 0) sharedOutlineCacheOrder.splice(sharedIdx, 1)
  sharedOutlineCacheOrder.push(path)
  while (sharedOutlineCacheOrder.length > MAX_OUTLINE_CACHE_ENTRIES) {
    const oldest = sharedOutlineCacheOrder.shift()
    if (oldest != null) sharedOutlineHeadingsCache.delete(oldest)
  }
}

/** Synchronous read for outline UI fallback (same cache as the sidebar hook). */
export function getCachedSidebarOutlineHeadings(path: string): TocHeading[] | undefined {
  if (!path) return undefined
  return sharedOutlineHeadingsCache.get(path)
}

function resolveOutlineMarkdown(activePath: string): string {
  const tabBody = getTabBody(activePath)
  if (tabBody != null) return tabBody

  const kernel = getDocumentRuntimeSnapshot()
  if (pathsEqual(kernel.activePath, activePath)) return kernel.content

  // Tab switch in flight — never parse stale React `content` from the previous tab.
  return ''
}

/** Sidebar outline: tab-body cache + per-document heading cache (smooth tab switch). */
export function useSidebarOutlineHeadings(activePath: string, content: string): TocHeading[] {
  const cacheRef = useRef(new Map<string, { content: string; headings: TocHeading[] }>())
  const orderRef = useRef<string[]>([])

  return useMemo(() => {
    if (!activePath) return []

    const markdown = resolveOutlineMarkdown(activePath)
    const cached = cacheRef.current.get(activePath)

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
  }, [activePath, content])
}
