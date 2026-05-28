import { useMemo, useRef } from 'react'

import { parseOutlineHeadingsFromMarkdown } from '../../editor/markdownOutlineFromMarkdown'
import type { TocHeading } from '../components/DocumentOutlineBlock'

const MAX_OUTLINE_CACHE_ENTRIES = 32

/** Sidebar outline: single Markdown source + per-document cache (avoid flash on tab switch).*/
export function useSidebarOutlineHeadings(activePath: string, content: string): TocHeading[] {
  const cacheRef = useRef(new Map<string, { content: string; headings: TocHeading[] }>())
  const orderRef = useRef<string[]>([])

  return useMemo(() => {
    const cached = activePath ? cacheRef.current.get(activePath) : undefined
    if (cached && cached.content === content) return cached.headings

    if (!content.trim() && activePath && cached) {
      return cached.headings
    }

    const headings = parseOutlineHeadingsFromMarkdown(content)
    if (activePath) {
      cacheRef.current.set(activePath, { content, headings })
      const order = orderRef.current
      const idx = order.indexOf(activePath)
      if (idx >= 0) order.splice(idx, 1)
      order.push(activePath)
      while (order.length > MAX_OUTLINE_CACHE_ENTRIES) {
        const oldest = order.shift()
        if (oldest != null) cacheRef.current.delete(oldest)
      }
    }
    return headings
  }, [activePath, content])
}
