import { RECENT_FILES_LIMIT } from '../app/workspace/constants'
import { filterOutPath, isValidRecentFilePath, sanitizeRecentFilePaths } from './workspacePathUtils'

export const RECENT_FILES_STORAGE_KEY = 'recentFiles'

export function readRecentFilesFromStorage(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_FILES_STORAGE_KEY) ?? '[]') as unknown
    return sanitizeRecentFilePaths(Array.isArray(raw) ? raw : [])
  } catch {
    return []
  }
}

export function writeRecentFilesToStorage(paths: readonly string[]): string[] {
  const next = sanitizeRecentFilePaths(paths).slice(0, RECENT_FILES_LIMIT)
  const serialized = JSON.stringify(next)
  if (localStorage.getItem(RECENT_FILES_STORAGE_KEY) !== serialized) {
    localStorage.setItem(RECENT_FILES_STORAGE_KEY, serialized)
  }
  return next
}

export function mergeRecentFilePath(paths: readonly string[], path: string): string[] {
  if (!isValidRecentFilePath(path)) return [...paths]
  return writeRecentFilesToStorage([path, ...filterOutPath(paths, path)])
}

export function clearRecentFilesStorage(): string[] {
  return writeRecentFilesToStorage([])
}
