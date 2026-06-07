import { isHiddenAssetFolderName, pathsEqual, relativePathUnderRoot } from '../../lib/workspacePathUtils'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode } from './types'

export const collectDirPaths = (nodes: FsTreeNode[]): string[] => {
  const out: string[] = []
  for (const n of nodes) {
    if (n.kind === 'dir') {
      out.push(n.path, ...collectDirPaths(n.children))
    }
  }
  return out
}

export const firstMarkdownInTree = (nodes: FsTreeNode[]): string | null => {
  for (const n of nodes) {
    if (n.kind === 'file') return n.path
    const nested = firstMarkdownInTree(n.children)
    if (nested) return nested
  }
  return null
}

export function resolveTreeFilePath(nodes: FsTreeNode[], path: string): string | null {
  for (const n of nodes) {
    if (n.kind === 'file' && pathsEqual(n.path, path)) return n.path
    if (n.kind === 'dir') {
      const nested = resolveTreeFilePath(n.children, path)
      if (nested) return nested
    }
  }
  return null
}

export function pathExistsInTree(nodes: FsTreeNode[], path: string): boolean {
  return resolveTreeFilePath(nodes, path) != null
}

export const countMarkdownInTree = (nodes: FsTreeNode[]): number =>
  nodes.reduce((acc, n) => acc + (n.kind === 'file' ? 1 : countMarkdownInTree(n.children)), 0)

export function normalizeNewNoteStemInput(raw: string, defaultStem: string): string {
  let s = raw.trim()
  if (!s) return defaultStem
  s = s.replace(/\.(md|markdown)$/iu, '').trim()
  if (!s) return defaultStem
  return s
}

export function noteFileStem(notePath: string): string {
  const base = notePath.replace(/\\/g, '/').split('/').pop() ?? ''
  return base.replace(/\.(md|markdown)$/i, '')
}

/** Flatten workspace tree into sorted file list (for sidebar list view)*/
export function flattenWorkspaceFiles(nodes: FsTreeNode[], rootDir: string): FlatWorkspaceFile[] {
  const out: FlatWorkspaceFile[] = []
  const walk = (ns: FsTreeNode[]) => {
    for (const n of ns) {
      if (n.kind === 'file') {
        const rel = relativePathUnderRoot(rootDir, n.path) ?? n.name
        const lastSlash = rel.lastIndexOf('/')
        const label = lastSlash >= 0 ? rel.slice(lastSlash + 1) : rel
        const folder = lastSlash >= 0 ? rel.slice(0, lastSlash) : undefined
        out.push({
          path: n.path,
          label,
          sublabel: folder,
          relativePath: rel,
          modifiedAtMs: n.modifiedAtMs ?? null,
          createdAtMs: n.createdAtMs ?? null,
        })
      } else if (!isHiddenAssetFolderName(n.name)) {
        walk(n.children)
      }
    }
  }
  walk(nodes)
  out.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
  return out
}

export function sortWorkspaceTree(nodes: FsTreeNode[], mode: FileSortMode): FsTreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    const dirA = a.kind === 'dir'
    const dirB = b.kind === 'dir'
    if (mode === 'group' && dirA !== dirB) return dirA ? -1 : 1
    if (mode === 'modifiedAsc') {
      const av = a.modifiedAtMs ?? Number.MAX_SAFE_INTEGER
      const bv = b.modifiedAtMs ?? Number.MAX_SAFE_INTEGER
      return av - bv || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    if (mode === 'createdAsc') {
      const av = a.createdAtMs ?? Number.MAX_SAFE_INTEGER
      const bv = b.createdAtMs ?? Number.MAX_SAFE_INTEGER
      return av - bv || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    if (mode === 'nameAsc') {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  })
  return sorted.map((n) => (n.kind === 'dir' ? { ...n, children: sortWorkspaceTree(n.children, mode) } : n))
}

export function filterSidebarWorkspaceTree(nodes: FsTreeNode[]): FsTreeNode[] {
  const out: FsTreeNode[] = []
  for (const n of nodes) {
    if (n.kind === 'dir') {
      if (isHiddenAssetFolderName(n.name)) continue
      out.push({ ...n, children: filterSidebarWorkspaceTree(n.children) })
    } else {
      out.push(n)
    }
  }
  return out
}

function nodeMatchesFilterQuery(node: FsTreeNode, query: string, rootDir: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true
  const rel = relativePathUnderRoot(rootDir, node.path)
  return Boolean(rel && rel.toLowerCase().includes(query))
}

/** Client-side filename / path filter for the sidebar file tree.*/
export function filterWorkspaceTreeByQuery(nodes: FsTreeNode[], rawQuery: string, rootDir: string): FsTreeNode[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return nodes

  const out: FsTreeNode[] = []
  for (const n of nodes) {
    if (n.kind === 'dir') {
      const children = filterWorkspaceTreeByQuery(n.children, query, rootDir)
      if (children.length > 0 || n.name.toLowerCase().includes(query)) {
        out.push({ ...n, children })
      }
    } else if (nodeMatchesFilterQuery(n, query, rootDir)) {
      out.push(n)
    }
  }
  return out
}

export function countFilesInTree(nodes: FsTreeNode[]): number {
  return nodes.reduce((acc, n) => acc + (n.kind === 'file' ? 1 : countFilesInTree(n.children)), 0)
}
