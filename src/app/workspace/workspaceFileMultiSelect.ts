import { pathSetHas, pathsEqual } from '../../lib/workspacePathUtils'
import type { FsTreeNode } from './types'

/** Visible file paths in tree order (respects expanded folders). */
export function collectVisibleFilePathsInTree(
  nodes: readonly FsTreeNode[],
  expandedDirs: ReadonlySet<string>,
): string[] {
  const out: string[] = []
  const walk = (ns: readonly FsTreeNode[]) => {
    for (const n of ns) {
      if (n.kind === 'file') {
        out.push(n.path)
      } else if (pathSetHas(expandedDirs, n.path)) {
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return out
}

export function computeShiftRangeSelection(
  orderedPaths: readonly string[],
  anchorPath: string,
  targetPath: string,
): string[] {
  const anchorIdx = orderedPaths.findIndex((p) => pathsEqual(p, anchorPath))
  const targetIdx = orderedPaths.findIndex((p) => pathsEqual(p, targetPath))
  if (anchorIdx < 0) return targetIdx >= 0 ? [orderedPaths[targetIdx]!] : [targetPath]
  if (targetIdx < 0) return [anchorPath]
  const start = Math.min(anchorIdx, targetIdx)
  const end = Math.max(anchorIdx, targetIdx)
  return orderedPaths.slice(start, end + 1)
}
