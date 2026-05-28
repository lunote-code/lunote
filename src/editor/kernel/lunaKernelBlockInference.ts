import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Block inference (observation layer): Derive a "top-level block" view from PM doc for easy debugging.
 *
 * Architectural Contract (must be maintained):
 * - ProseMirror / Tiptap doc is a single editable model.
 * - `inferRuntimeBlocksFromPmDoc` and `LunaInferredBlock` are only observers: verification, debugging, and subsequent PM comparison.
 * Must not be promoted to a main structure model and must not drive transaction/command/selection recovery.
 * - runtime `blockId` does not fall into doc and is not persistent; it does not replace PM position or schema.
 */
export type LunaInferredBlockKind = 'paragraph' | 'heading' | 'table' | 'code' | 'other'

export type LunaInferredBlock = {
  /** Stable within a single scan, not persistent; format `rblk:{startPos}:{type}:{childIndex}`*/
  blockId: string
  /** PM node type name (such as codeBlock)*/
  type: string
  kind: LunaInferredBlockKind
  /** The starting position of the block node in the document (immediately before the beginning of the node)*/
  startPos: number
  /** The first position after the block node (half-open interval [startPos, endPos))*/
  endPos: number
  /** The serial number of the first level sub-node under doc*/
  index: number
}

function classifyTopLevelBlock(node: PMNode): { kind: LunaInferredBlockKind; type: string } {
  const name = node.type.name
  if (name === 'heading') return { kind: 'heading', type: 'heading' }
  if (name === 'paragraph') return { kind: 'paragraph', type: 'paragraph' }
  if (name === 'table') return { kind: 'table', type: 'table' }
  if (name === 'codeBlock' || name === 'mermaidBlock') return { kind: 'code', type: name }
  return { kind: 'other', type: name }
}

/**
 * Read-only: Infer the "block" list from the first-level child nodes under the doc root, without accessing the schema definition or modifying the document.
 * Containers such as lists/references appear as whole blocks; inner paragraphs are not expanded.
 */
export function inferRuntimeBlocksFromPmDoc(doc: PMNode): LunaInferredBlock[] {
  const out: LunaInferredBlock[] = []
  if (doc.childCount === 0) return out

  let pos = 1
  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i)
    const startPos = pos
    const endPos = pos + node.nodeSize
    const { kind, type } = classifyTopLevelBlock(node)
    const blockId = `rblk:${startPos}:${type}:${i}`
    out.push({ blockId, type, kind, startPos, endPos, index: i })
    pos += node.nodeSize
  }
  return out
}
