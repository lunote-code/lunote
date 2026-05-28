import type { SearchHit } from '../editor/knowledgeRuntime/types'
import { absolutePathToDocKeyOs } from '../editor/knowledgeOS/vaultRuntime'
import { searchWorkspaceNotes } from '../platform/tauri/searchService'

export async function searchNotesBackend(
  workspaceRoot: string,
  query: string,
  limit = 30,
  options?: { preserveSnippetMarks?: boolean },
): Promise<SearchHit[]> {
  const root = workspaceRoot.replace(/[/\\]+$/u, '')
  if (!root.trim() || !query.trim()) return []
  try {
    const rows = await searchWorkspaceNotes(root, query, limit)
    return rows.map((row) => ({
      docKey: absolutePathToDocKeyOs(row.path, root),
      absolutePath: row.path,
      title: row.title,
      score: 95,
      snippet: options?.preserveSnippetMarks
        ? row.snippet
        : row.snippet.replace(/<\/?mark>/giu, ''),
      matchKind: 'content' as const,
    }))
  } catch (error) {
    console.warn('[noteSearch] backend FTS failed', error)
    return []
  }
}
