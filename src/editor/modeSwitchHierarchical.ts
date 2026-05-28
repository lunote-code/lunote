import type { Node as PMNode } from 'prosemirror-model'

import { collectProjectablePmLeafRows, deriveProjectableLeafPathAtPmPos } from './modeSwitchLeafRow'
import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'

/**
 * Deriving hierarchical anchors from PM selection endpoints: **doc structure traversal only** (`resolve` / `textBetween`); only called on freeze entry.
 */
function rowIndexForKey(doc: PMNode, rowKey: string): number {
  const rows = collectProjectablePmLeafRows(doc)
  const hit = rows.findIndex((row) => row.rowKey === rowKey)
  return hit >= 0 ? hit : 0
}

function textLenBeforeRelInBlock(block: PMNode, rel: number): number {
  const r = Math.max(0, Math.min(rel, block.content.size))
  try {
    return block.textBetween(0, r, '\n', '\n').length
  } catch {
    return 0
  }
}

export function deriveHierarchicalSelectionFromPm(doc: PMNode, pos: number): HierarchicalSelectionCore {
  const leaf = deriveProjectableLeafPathAtPmPos(doc, pos)
  if (!leaf) {
    return {
      blockIndex: 0,
      blockPath: Object.freeze([]),
      rowKey: 'root',
      intraBlockOffset: 0,
    }
  }
  const block = leaf.blockPath.reduce<PMNode>((node, idx) => node.child(idx), doc)
  const innerOff = Math.min(Math.max(0, pos - leaf.pmStart), Math.max(0, block.content.size))
  const intra = textLenBeforeRelInBlock(block, innerOff)
  return {
    blockIndex: rowIndexForKey(doc, leaf.rowKey),
    blockPath: leaf.blockPath,
    rowKey: leaf.rowKey,
    intraBlockOffset: intra,
  }
}
