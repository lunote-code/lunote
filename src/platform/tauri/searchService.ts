import { invoke, isTauri } from '@tauri-apps/api/core'

export type BackendSearchRow = {
  path: string
  title: string
  snippet: string
}

export async function searchWorkspaceNotes(
  workspaceRoot: string,
  query: string,
  limit = 30,
): Promise<BackendSearchRow[]> {
  const root = workspaceRoot.replace(/[/\\]+$/u, '')
  if (!isTauri() || !root.trim() || !query.trim()) return []
  return invoke<BackendSearchRow[]>('search_notes', {
    payload: { query, limit, workspaceRoot: root },
  })
}
