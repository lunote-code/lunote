import { isTauri } from '@tauri-apps/api/core'

import { getDocumentMetaByPath } from '../../editor/knowledgeRuntime'
import { searchNotesBackend } from '../../lib/noteSearch'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { SearchResult } from '../workspace/types'
import { buildWorkspaceSearchFields } from './workspaceSearchText'

export type WorkspaceSearchIndexEntry = {
  path: string
  /** File name label from the workspace tree. */
  title: string
  sublabel: string
  relativePath: string
  /** Frontmatter / knowledge display title when known. */
  displayTitle?: string
  /** Extra searchable text (display title + markdown headings). */
  matchText?: string
}

type RankedWorkspaceSearchResult = SearchResult & {
  rank: number
}

export function enrichWorkspaceSearchIndexEntry(
  entry: WorkspaceSearchIndexEntry,
): WorkspaceSearchIndexEntry {
  if (entry.displayTitle != null && entry.matchText != null) return entry
  const meta = getDocumentMetaByPath(entry.path)
  if (!meta) return entry
  const fields = buildWorkspaceSearchFields({ fileLabel: entry.title, meta })
  return {
    ...entry,
    displayTitle: entry.displayTitle ?? fields.displayTitle,
    matchText: entry.matchText ?? fields.matchText,
  }
}

function resolveWorkspaceSearchResultTitle(entry: WorkspaceSearchIndexEntry): string {
  const display = entry.displayTitle?.trim()
  if (display) return display
  return entry.title
}

export function scoreWorkspaceMetadataMatch(query: string, entry: WorkspaceSearchIndexEntry): number {
  const enriched = enrichWorkspaceSearchIndexEntry(entry)
  const q = query.toLowerCase()
  const fileName = enriched.title.toLowerCase()
  const relativePath = enriched.relativePath.toLowerCase()
  const sublabel = enriched.sublabel.toLowerCase()
  const displayTitle = (enriched.displayTitle ?? '').toLowerCase()
  const matchText = (enriched.matchText ?? '').toLowerCase()

  if (displayTitle === q || fileName === q || relativePath === q) return 1000
  if (displayTitle.startsWith(q)) return 920
  if (fileName.startsWith(q)) return 850
  if (relativePath.startsWith(q)) return 760
  if (displayTitle.includes(q)) return 720
  if (fileName.includes(q)) return 680
  if (matchText.includes(q)) return 660
  if (relativePath.includes(q)) return 620
  if (sublabel.includes(q)) return 520
  return 0
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

  const byPath = new Map<string, RankedWorkspaceSearchResult>()
  for (const rawEntry of index) {
    const entry = enrichWorkspaceSearchIndexEntry(rawEntry)
    const rank = scoreWorkspaceMetadataMatch(q, entry)
    if (rank > 0) {
      byPath.set(entry.path, {
        path: entry.path,
        title: resolveWorkspaceSearchResultTitle(entry),
        snippet: entry.sublabel,
        rank,
      })
    }
  }

  if (isTauri()) {
    const ftsHits = await searchNotesBackend(rootDir, rawQuery, limit, { preserveSnippetMarks: true })
    for (const hit of ftsHits) {
      const sidebarPath = resolveSidebarPath(hit.absolutePath) ?? hit.absolutePath
      const indexed = enrichWorkspaceSearchIndexEntry(
        index.find((f) => pathsEqual(f.path, sidebarPath)) ?? {
          path: sidebarPath,
          title: hit.title,
          sublabel: '',
          relativePath: hit.title,
        },
      )
      const existingKey = [...byPath.keys()].find((key) => pathsEqual(key, sidebarPath))
      const existing = existingKey ? byPath.get(existingKey) : undefined
      const snippet = hit.snippet || existing?.snippet || indexed.sublabel || ''
      const rank = Math.max(existing?.rank ?? 0, 900 + Math.min(80, Math.round(hit.score)))
      byPath.set(existingKey ?? sidebarPath, {
        path: sidebarPath,
        title: resolveWorkspaceSearchResultTitle(indexed),
        snippet,
        rank,
      })
    }
  }

  return [...byPath.values()]
    .sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ rank: _rank, ...result }) => result)
}

function entryMatchesQuickSwitcherQuery(entry: WorkspaceSearchIndexEntry, q: string): boolean {
  const enriched = enrichWorkspaceSearchIndexEntry(entry)
  const haystacks = [
    enriched.title,
    enriched.relativePath,
    enriched.sublabel,
    enriched.displayTitle ?? '',
    enriched.matchText ?? '',
  ]
  return haystacks.some((text) => text.toLowerCase().includes(q))
}

export function runWorkspaceQuickSwitcherSearch(
  query: string,
  index: readonly WorkspaceSearchIndexEntry[],
  recentPaths: readonly string[],
  limit = 30,
): SearchResult[] {
  const q = query.trim().toLowerCase()

  const toResult = (entry: WorkspaceSearchIndexEntry): SearchResult => {
    const enriched = enrichWorkspaceSearchIndexEntry(entry)
    return {
      path: enriched.path,
      title: resolveWorkspaceSearchResultTitle(enriched),
      snippet: enriched.relativePath || enriched.sublabel,
    }
  }

  if (!q) {
    const seen = new Set<string>()
    const results: SearchResult[] = []
    for (const recentPath of recentPaths) {
      const hit = index.find((f) => pathsEqual(f.path, recentPath))
      if (!hit || seen.has(hit.path)) continue
      seen.add(hit.path)
      results.push(toResult(hit))
      if (results.length >= limit) return results
    }
    for (const entry of index) {
      if (seen.has(entry.path)) continue
      seen.add(entry.path)
      results.push(toResult(entry))
      if (results.length >= limit) return results
    }
    return results
  }

  const out: SearchResult[] = []
  for (const entry of index) {
    if (entryMatchesQuickSwitcherQuery(entry, q)) {
      out.push(toResult(entry))
      if (out.length >= limit) break
    }
  }
  return out
}
