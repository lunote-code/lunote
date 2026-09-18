import type { Node as PmNode } from '@tiptap/pm/model'

import {
  isBlockAiSupportedType,
  type BlockAiBlockType,
  type BlockAiTargetSnapshot,
} from './editorBlockAiActions'

function snapshotFromSerializedBlock(
  pos: number,
  node: PmNode,
  blockType: BlockAiBlockType,
  serializeBlock: (node: PmNode) => string,
): BlockAiTargetSnapshot {
  return {
    blockType,
    from: pos,
    to: pos + node.nodeSize,
    blockMarkdown: serializeBlock(node),
  }
}

/** Scan doc for a supported block whose serialized markdown matches the snapshot. */
export function findBlockAiTargetByMarkdown(
  doc: PmNode,
  snapshot: BlockAiTargetSnapshot,
  serializeBlock: (node: PmNode) => string,
): BlockAiTargetSnapshot | null {
  const needle = snapshot.blockMarkdown.trim()
  if (!needle) return null

  let found: BlockAiTargetSnapshot | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name !== snapshot.blockType || !isBlockAiSupportedType(node.type.name)) return
    if (serializeBlock(node).trim() !== needle) return
    found = snapshotFromSerializedBlock(pos, node, snapshot.blockType, serializeBlock)
    return false
  })
  return found
}

/** Re-resolve block range from current doc before apply (streaming may have changed positions). */
export function revalidateBlockAiTargetSnapshotDoc(
  doc: PmNode,
  snapshot: BlockAiTargetSnapshot,
  serializeBlock: (node: PmNode) => string,
): BlockAiTargetSnapshot | null {
  const docSize = doc.content.size
  if (docSize === 0) return null

  const needle = snapshot.blockMarkdown.trim()

  const tryTarget = (pos: number, node: PmNode): BlockAiTargetSnapshot | null => {
    if (node.type.name !== snapshot.blockType) return null
    const resolved = snapshotFromSerializedBlock(pos, node, snapshot.blockType, serializeBlock)
    if (!needle || resolved.blockMarkdown.trim() === needle) return resolved
    return null
  }

  const clampedFrom = Math.max(0, Math.min(snapshot.from, docSize))
  try {
    const $pos = doc.resolve(clampedFrom)
    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const resolved = tryTarget($pos.before(depth), $pos.node(depth))
      if (resolved) return resolved
    }
  } catch {
    // fall through
  }

  const nodeAtFrom = doc.nodeAt(clampedFrom)
  if (nodeAtFrom) {
    const resolved = tryTarget(clampedFrom, nodeAtFrom)
    if (resolved) return resolved
  }

  if (snapshot.from >= 0 && snapshot.to <= docSize && snapshot.from < snapshot.to) {
    const nodeAtSnapshot = doc.nodeAt(snapshot.from)
    if (nodeAtSnapshot) {
      const resolved = tryTarget(snapshot.from, nodeAtSnapshot)
      if (resolved) return resolved
    }
  }

  return findBlockAiTargetByMarkdown(doc, snapshot, serializeBlock)
}
