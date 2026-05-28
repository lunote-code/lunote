/** Attachment directories not displayed in the sidebar document list/tree view (such as `Note.assets`)*/
export function isHiddenAssetFolderName(name: string): boolean {
  return name.endsWith('.assets')
}

/** Canonical paths used for prefix comparison (consistent with Rust-side string phase, without symlink resolution)*/
export function normPath(p: string): string {
  let s = p.trim()
  if (s.startsWith('\\\\?\\')) s = s.slice(4)
  else if (s.startsWith('//?/')) s = s.slice(4)
  return s.replace(/\\/g, '/').replace(/\/+$/u, '')
}

/** Windows/UNC path comparison ignores case*/
function normPathForCompare(p: string): string {
  const normalized = normPath(p)
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')) {
    return normalized.toLowerCase()
  }
  return normalized
}

/** Path comparison keys (for vault/workspace IDs, map keys, etc.)*/
export function pathCompareKey(p: string): string {
  return normPathForCompare(p)
}

/** Compares two paths to see if they point to the same location (ignoring delimiters and Windows case differences)*/
export function pathsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a === b
  return normPathForCompare(a) === normPathForCompare(b)
}

/** Whether the path contains a `..` segment (directory traversal is prohibited)*/
export function pathHasParentDirSegment(path: string): boolean {
  const normalized = normPath(path)
  return normalized.split('/').some((part) => part === '..')
}

export function isPathUnderWorkspace(root: string, filePath: string): boolean {
  if (pathHasParentDirSegment(filePath)) return false
  const r = normPathForCompare(root)
  const f = normPathForCompare(filePath)
  return f === r || f.startsWith(`${r}/`)
}

/** Stable ID of the workspace root directory (case consistent across platforms)*/
export function workspaceIdFromRoot(rootDir: string): string {
  return pathCompareKey(rootDir).replace(/[^a-z0-9_-]+/gu, '_')
}

/** Returns the relative path if filePath is located under root, otherwise null*/
export function relativePathUnderRoot(root: string, filePath: string): string | null {
  if (!isPathUnderWorkspace(root, filePath)) return null
  const rootNorm = normPath(root)
  const fileNorm = normPath(filePath)
  if (pathsEqual(root, filePath)) return ''
  return fileNorm.slice(rootNorm.length + 1)
}

export function pathInList(path: string, list: readonly string[]): boolean {
  return list.some((item) => pathsEqual(item, path))
}

export function filterOutPath(list: readonly string[], path: string): string[] {
  return list.filter((item) => !pathsEqual(item, path))
}

export function replacePathInList(
  list: readonly string[],
  oldPath: string,
  newPath: string,
): string[] {
  return list.map((item) => (pathsEqual(item, oldPath) ? newPath : item))
}

export function upsertPathInList(list: readonly string[], path: string): string[] {
  if (pathInList(path, list)) return [...list]
  return [...list, path]
}

export function pathSetHas(set: ReadonlySet<string>, path: string): boolean {
  for (const item of set) {
    if (pathsEqual(item, path)) return true
  }
  return false
}

export function togglePathInSet(set: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set<string>()
  let removed = false
  for (const item of set) {
    if (pathsEqual(item, path)) {
      removed = true
      continue
    }
    next.add(item)
  }
  if (!removed) next.add(path)
  return next
}

/** Whether the path is under any of the allowed roots (`..` sections are prohibited for each root)
 * Note: Canonicalize is used on the Rust side; backend verification should still be given priority before writing/IPC.
 */
export function isPathUnderAllowedRoots(filePath: string, roots: readonly string[]): boolean {
  if (pathHasParentDirSegment(filePath)) return false
  const f = normPathForCompare(filePath)
  if (!f) return false
  return roots.some((root) => {
    const r = normPathForCompare(root)
    if (!r) return false
    return f === r || f.startsWith(`${r}/`)
  })
}

/** Parse and verify that the file path is within the workspace, returning a path string that can be used for IPC*/
export function resolveWorkspaceFilePath(workspaceRoot: string, filePath: string): string {
  if (pathHasParentDirSegment(filePath)) {
    throw new Error('Path cannot contain ..')
  }
  const rootNorm = normPathForCompare(workspaceRoot)
  if (!rootNorm) throw new Error('Invalid workspace path')

  const trimmed = filePath.trim()
  const fileNorm = normPathForCompare(trimmed)
  if (fileNorm === rootNorm || fileNorm.startsWith(`${rootNorm}/`)) {
    return trimmed
  }

  const relNorm = normPath(trimmed)
  const isAbsolute = /^[A-Za-z]:\//.test(relNorm) || relNorm.startsWith('/')
  if (isAbsolute) {
    throw new Error('Target path is outside the workspace')
  }

  const joined = joinRelativePath(workspaceRoot, trimmed)
  const joinedNorm = normPathForCompare(joined)
  if (joinedNorm === rootNorm || joinedNorm.startsWith(`${rootNorm}/`)) {
    return joined
  }

  throw new Error('Target path is outside the workspace')
}

/** Verify before writing: must be in the workspace and must not contain `..`*/
export function assertWritablePathInWorkspace(workspaceRoot: string, filePath: string): void {
  resolveWorkspaceFilePath(workspaceRoot, filePath)
}

/** Relative path splicing (disallows `..` and absolute paths)*/
export function joinRelativePath(baseDir: string, relativePath: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\.\//u, '')
  if (pathHasParentDirSegment(rel)) {
    throw new Error('Relative path cannot contain ..')
  }
  if (rel.startsWith('/')) {
    throw new Error('Relative path cannot be absolute')
  }
  const base = normPath(baseDir)
  const joined = base ? `${base}/${rel}` : rel
  return joined.replace(/\/+/g, '/')
}

/** The parent directory of the file path (for creating new files in the same directory); for files under the root, the parent path without the trailing separator is returned.*/
export function parentDirectoryOfFile(filePath: string): string {
  let i = filePath.lastIndexOf('/')
  const j = filePath.lastIndexOf('\\')
  if (j > i) i = j
  return i < 0 ? '' : filePath.slice(0, i)
}

/** A path chain from the workspace root to the file's parent directory, used for sidebar expansion*/
export function ancestorDirPathsForFile(workspaceRoot: string, filePath: string): string[] {
  if (!isPathUnderWorkspace(workspaceRoot, filePath)) return []
  const rootKey = normPathForCompare(workspaceRoot)
  const dirs: string[] = []
  let cur = parentDirectoryOfFile(filePath)
  while (cur) {
    const curKey = normPathForCompare(cur)
    if (curKey.length < rootKey.length || !(curKey === rootKey || curKey.startsWith(`${rootKey}/`))) break
    dirs.push(cur)
    if (curKey === rootKey) break
    cur = parentDirectoryOfFile(cur)
  }
  dirs.reverse()
  return dirs
}
