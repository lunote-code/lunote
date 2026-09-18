import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

import { canonicalMarkdownSemantics } from '../../markdown/canonicalMarkdownSemantics'
import { resolveActiveBlockSelectionTarget } from '../tiptapEditorSourceIslandRuntime'
import {
  isBlockAiSupportedType,
  type BlockAiBlockType,
  type BlockAiTargetSnapshot,
} from './editorBlockAiActions'
import { revalidateBlockAiTargetSnapshotDoc } from './editorBlockAiRevalidate'

export { findBlockAiTargetByMarkdown, revalidateBlockAiTargetSnapshotDoc } from './editorBlockAiRevalidate'

export type {
  BlockAiActionId,
  BlockAiBlockType,
  BlockAiTargetSnapshot,
} from './editorBlockAiActions'

export {
  BLOCK_AI_SUPPORTED_TYPES,
  blockAiActionLabelKey,
  buildBlockAiSystemHint,
  buildBlockAiUserMessage,
  listBlockAiActions,
  resolveBlockAiApplyMode,
  resolveBlockAiTaskMode,
} from './editorBlockAiActions'

export type BlockAiTarget = {
  blockType: BlockAiBlockType
  from: number
  to: number
  pos: number
  node: PmNode
}

const OUTER_BLOCK_TYPES = new Set<BlockAiBlockType>([
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
  'callout',
  'table',
  'codeBlock',
])
const CONTAINER_POSITION_PARENT_TYPES = new Set<BlockAiBlockType>([
  'callout',
  'table',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
])

function targetFromNode(pos: number, node: PmNode, blockType: BlockAiBlockType): BlockAiTarget {
  return { blockType, from: pos, to: pos + node.nodeSize, pos, node }
}

/** Prefer table/callout/codeBlock over nested paragraph when the cursor is inside them. */
export function resolveBlockAiTarget(editor: Editor): BlockAiTarget | null {
  const { selection } = editor.state
  if (selection instanceof NodeSelection) {
    const blockType = selection.node.type.name
    if (!isBlockAiSupportedType(blockType)) return null
    return targetFromNode(selection.from, selection.node, blockType)
  }

  const $from = selection.$from
  let paragraphTarget: BlockAiTarget | null = null
  for (let depth = 1; depth <= $from.depth; depth += 1) {
    const node = $from.node(depth)
    const blockType = node.type.name
    if (!isBlockAiSupportedType(blockType)) continue
    const pos = $from.before(depth)
    const target = targetFromNode(pos, node, blockType)
    if (OUTER_BLOCK_TYPES.has(blockType)) return target
    paragraphTarget = target
  }

  if (paragraphTarget) return paragraphTarget

  const fallback = resolveActiveBlockSelectionTarget(editor)
  if (!fallback || !isBlockAiSupportedType(fallback.blockType)) return null
  return targetFromNode(fallback.pos, fallback.node, fallback.blockType)
}

export type BlockAiRevealValidation =
  | { kind: 'valid'; target: BlockAiTarget }
  | { kind: 'dismiss' }
  | { kind: 'unsupported'; silent: boolean }

/** Whether the block AI handle should stay revealed for the current selection. */
export function validateBlockAiRevealState(editor: Editor): BlockAiRevealValidation {
  const { from, to } = editor.state.selection
  if (from !== to) return { kind: 'dismiss' }

  const blockTarget = resolveBlockAiTarget(editor)
  if (!blockTarget) {
    return {
      kind: 'unsupported',
      silent: isBlockAiSilentUnsupportedClick(editor),
    }
  }

  if (blockTarget.blockType === 'codeBlock') return { kind: 'dismiss' }
  if (isBlockAiTargetEmpty(editor, blockTarget)) return { kind: 'dismiss' }

  return { kind: 'valid', target: blockTarget }
}

/** Inner block anchor for handle placement when the cursor is inside callout/table. */
export function resolveBlockAiPositionAnchor(
  editor: Editor,
  target: BlockAiTarget,
): Pick<BlockAiTarget, 'from' | 'to' | 'pos'> {
  if (!CONTAINER_POSITION_PARENT_TYPES.has(target.blockType)) {
    return { from: target.from, to: target.to, pos: target.pos }
  }

  const { selection } = editor.state
  const $from = selection.$from
  let innerTarget: BlockAiTarget | null = null

  for (let depth = 1; depth <= $from.depth; depth += 1) {
    const node = $from.node(depth)
    const blockType = node.type.name
    if (!isBlockAiSupportedType(blockType)) continue
    if (OUTER_BLOCK_TYPES.has(blockType)) continue
    innerTarget = targetFromNode($from.before(depth), node, blockType)
  }

  if (innerTarget) {
    return { from: innerTarget.from, to: innerTarget.to, pos: innerTarget.pos }
  }

  return { from: target.from, to: target.to, pos: target.pos }
}

export function serializeBlockAiTargetMarkdown(editor: Editor, target: BlockAiTarget): string {
  return canonicalMarkdownSemantics.serializeBlock(target.node, editor.schema).trim()
}

export function isBlockAiTargetEmpty(editor: Editor, target: BlockAiTarget): boolean {
  return !serializeBlockAiTargetMarkdown(editor, target).trim()
}

/** Blocks that cannot use Block AI but should not show an unsupported toast on click. */
const BLOCK_AI_SILENT_UNSUPPORTED_TYPES = new Set([
  'mermaidBlock',
  'drawingBlock',
  'horizontalRule',
  'rawBlock',
  'wikiEmbed',
  'blockMath',
  'tocDirective',
  'linkReferenceDef',
  'footnoteDef',
])

export function isBlockAiSilentUnsupportedClick(editor: Editor): boolean {
  const { $from } = editor.state.selection
  for (let depth = 1; depth <= $from.depth; depth += 1) {
    if (BLOCK_AI_SILENT_UNSUPPORTED_TYPES.has($from.node(depth).type.name)) return true
  }
  return false
}

export function snapshotBlockAiTarget(editor: Editor, target: BlockAiTarget): BlockAiTargetSnapshot {
  return {
    blockType: target.blockType,
    from: target.from,
    to: target.to,
    blockMarkdown: serializeBlockAiTargetMarkdown(editor, target),
  }
}

/** Re-resolve block range from current doc before apply (streaming may have changed positions). */
export function revalidateBlockAiTargetSnapshot(
  editor: Editor,
  snapshot: BlockAiTargetSnapshot,
): BlockAiTargetSnapshot | null {
  const serializeBlock = (node: PmNode) =>
    canonicalMarkdownSemantics.serializeBlock(node, editor.schema).trim()
  return revalidateBlockAiTargetSnapshotDoc(editor.state.doc, snapshot, serializeBlock)
}

/** Snapshot a code block at a known doc position (for toolbar / in-block AI actions). */
export function snapshotCodeBlockAtPos(
  editor: Editor,
  pos: number,
  node: PmNode,
): BlockAiTargetSnapshot | null {
  if (node.type.name !== 'codeBlock' || pos < 0) return null
  return snapshotBlockAiTarget(editor, targetFromNode(pos, node, 'codeBlock'))
}
