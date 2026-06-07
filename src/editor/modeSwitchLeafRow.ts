import type { Node as PMNode, ResolvedPos } from 'prosemirror-model'

import { isModeSwitchExplicitAtomicLeafType } from './modeSwitchBlockGeometry'

export type ModeSwitchLeafPath = readonly number[]

export type ModeSwitchPmLeafRow = {
  readonly blockPath: ModeSwitchLeafPath
  readonly rowKey: string
  readonly blockType: string
  readonly withinTaskItem: boolean
  readonly node: PMNode
  readonly pmStart: number
  readonly pmEnd: number
}

export function freezeModeSwitchLeafPath(path: readonly number[]): ModeSwitchLeafPath {
  return Object.freeze([...path])
}

export function modeSwitchLeafPathToRowKey(path: readonly number[]): string {
  return path.length > 0 ? path.join('.') : 'root'
}

export function isProjectableLeafNode(node: PMNode): boolean {
  if (node.type.name === 'doc') return false
  if (isModeSwitchExplicitAtomicLeafType(node.type.name)) return true
  return node.isTextblock
}

function normalizeLeafPmBounds(pmStart: number, pmEnd: number): { pmStart: number; pmEnd: number } {
  return {
    pmStart,
    pmEnd: Math.max(pmStart, pmEnd),
  }
}

function childStartPos(parentStart: number, childOffset: number): number {
  return parentStart + 1 + childOffset
}

export function collectProjectablePmLeafRows(doc: PMNode): readonly ModeSwitchPmLeafRow[] {
  const rows: ModeSwitchPmLeafRow[] = []

  const visit = (node: PMNode, nodeStart: number, path: number[], withinTaskItem: boolean): void => {
    const nextWithinTaskItem = withinTaskItem || node.type.name === 'taskItem'
    if (isProjectableLeafNode(node)) {
      const bounds = normalizeLeafPmBounds(nodeStart + 1, nodeStart + node.nodeSize - 1)
      rows.push(
        Object.freeze({
          blockPath: freezeModeSwitchLeafPath(path),
          rowKey: modeSwitchLeafPathToRowKey(path),
          blockType: node.type.name,
          withinTaskItem: nextWithinTaskItem,
          node,
          pmStart: bounds.pmStart,
          pmEnd: bounds.pmEnd,
        }),
      )
      return
    }
    let childOffset = 0
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i)
      const start = childStartPos(nodeStart, childOffset)
      visit(child, start, [...path, i], nextWithinTaskItem)
      childOffset += child.nodeSize
    }
  }

  let offset = 0
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i)
    visit(child, offset, [i], false)
    offset += child.nodeSize
  }

  return Object.freeze(rows)
}

function pathFromResolvedDepth($pos: ResolvedPos, depth: number): ModeSwitchLeafPath {
  const path: number[] = []
  for (let d = 0; d < depth; d += 1) {
    path.push($pos.index(d))
  }
  return freezeModeSwitchLeafPath(path)
}

export function deriveProjectableLeafPathAtPmPos(
  doc: PMNode,
  pos: number,
): { blockPath: ModeSwitchLeafPath; rowKey: string; blockType: string; pmStart: number; pmEnd: number } | null {
  const innerMax = doc.content.size
  const clamped = Math.min(Math.max(1, pos), innerMax + 1)
  const $pos = doc.resolve(clamped)

  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const node = $pos.node(depth)
    if (!isModeSwitchExplicitAtomicLeafType(node.type.name)) continue
    const blockPath = pathFromResolvedDepth($pos, depth)
    const bounds = normalizeLeafPmBounds($pos.start(depth), $pos.end(depth))
    return {
      blockPath,
      rowKey: modeSwitchLeafPathToRowKey(blockPath),
      blockType: node.type.name,
      pmStart: bounds.pmStart,
      pmEnd: bounds.pmEnd,
    }
  }

  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const node = $pos.node(depth)
    if (!isProjectableLeafNode(node)) continue
    const blockPath = pathFromResolvedDepth($pos, depth)
    const bounds = normalizeLeafPmBounds($pos.start(depth), $pos.end(depth))
    return {
      blockPath,
      rowKey: modeSwitchLeafPathToRowKey(blockPath),
      blockType: node.type.name,
      pmStart: bounds.pmStart,
      pmEnd: bounds.pmEnd,
    }
  }

  const rows = collectProjectablePmLeafRows(doc)
  if (!rows.length) return null
  const fallback = rows[0]!
  return {
    blockPath: fallback.blockPath,
    rowKey: fallback.rowKey,
    blockType: fallback.blockType,
    pmStart: fallback.pmStart,
    pmEnd: fallback.pmEnd,
  }
}
