import { RECENT_WORKSPACES_LIMIT } from '../app/workspace/constants'
import { filterOutPath, isValidRecentWorkspacePath, sanitizeRecentWorkspacePaths } from './workspacePathUtils'

export const RECENT_WORKSPACES_STORAGE_KEY = 'recentWorkspaces'

export function readRecentWorkspacesFromStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY) ?? '[]') as unknown
    return sanitizeRecentWorkspacePaths(Array.isArray(raw) ? raw : [])
  } catch {
    return []
  }
}

export function writeRecentWorkspacesToStorage(paths: readonly string[]): string[] {
  const next = sanitizeRecentWorkspacePaths(paths).slice(0, RECENT_WORKSPACES_LIMIT)
  const serialized = JSON.stringify(next)
  if (localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY) !== serialized) {
    localStorage.setItem(RECENT_WORKSPACES_STORAGE_KEY, serialized)
  }
  return next
}

export function mergeRecentWorkspacePath(paths: readonly string[], path: string): string[] {
  if (!isValidRecentWorkspacePath(path)) return [...paths]
  return writeRecentWorkspacesToStorage([path, ...filterOutPath(paths, path)])
}

export function clearRecentWorkspacesStorage(): string[] {
  return writeRecentWorkspacesToStorage([])
}
