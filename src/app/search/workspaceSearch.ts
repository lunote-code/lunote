import { isTauri } from '@tauri-apps/api/core'

import { searchNotesBackend } from '../../lib/noteSearch'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { SearchResult } from '../workspace/types'

export type WorkspaceSearchIndexEntry = {
  path: string
  title: string
  sublabel: string
  relativePath: string
}

export async function runWorkspaceSearch(
  rootDir: string,
  query: string,
  index: readonly WorkspaceSearchIndexEntry[],
  limit = 30,
): Promise<SearchResult[]> {
  const rawQuery = query.trim()
  const q = rawQuery.toLowerCase()
  if (!rootDir.trim() || !q) return []

  const resolveSidebarPath = (path: string): string | undefined => {
    const hit = index.find((f) => pathsEqual(f.path, path))
    return hit?.path
  }

  const byPath = new Map<string, SearchResult>()
  for (const f of index) {
    if (
      f.title.toLowerCase().includes(q) ||
      f.relativePath.toLowerCase().includes(q) ||
      f.sublabel.toLowerCase().includes(q)
    ) {
      byPath.set(f.path, {
        path: f.path,
        title: f.title,
        snippet: f.sublabel,
      })
    }
  }

  if (isTauri()) {
    const ftsHits = await searchNotesBackend(rootDir, rawQuery, limit, { preserveSnippetMarks: true })
    for (const hit of ftsHits) {
      const sidebarPath = resolveSidebarPath(hit.absolutePath) ?? hit.absolutePath
      const indexed = index.find((f) => pathsEqual(f.path, sidebarPath))
      const title = indexed?.title ?? hit.title
      const existingKey = [...byPath.keys()].find((key) => pathsEqual(key, sidebarPath))
      const existing = existingKey ? byPath.get(existingKey) : undefined
      const snippet = hit.snippet || existing?.snippet || indexed?.sublabel || ''
      byPath.set(existingKey ?? sidebarPath, {
        path: sidebarPath,
        title,
        snippet,
      })
    }
  }

  return [...byPath.values()].slice(0, limit)
}
