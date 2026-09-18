import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export const HARD_BLOCK_TYPES_FOR_CLICK_BELOW: ReadonlySet<string> = new Set([
  'codeBlock',
  'mermaidBlock',
  'drawingBlock',
  'rawBlock',
  'blockMath',
  'tocDirective',
  'horizontalRule',
  'wikiEmbed',
])

export function isHardBlockTypeForClickBelow(name: string): boolean {
  return HARD_BLOCK_TYPES_FOR_CLICK_BELOW.has(name)
}

function topLevelNodePosAt(doc: PmNode, index: number): number {
  let pos = 0
  for (let i = 0; i < index; i += 1) {
    pos += doc.child(i).nodeSize
  }
  return pos
}

function isPrimaryPointer(event: MouseEvent): boolean {
  if (event.button !== 0) return false
  if (event.detail > 1) return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false
  return true
}

function insertEditableParagraphAt(editor: Editor, view: EditorView, insertPos: number): boolean {
  if (editor.isDestroyed) return false
  const paragraph = view.state.schema.nodes.paragraph
  if (!paragraph) return false
  let tr = view.state.tr.insert(insertPos, paragraph.create())
  tr = tr.setSelection(TextSelection.create(tr.doc, Math.min(insertPos + 1, tr.doc.content.size)))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

function resolveLastTopLevelHardBlockPos(view: EditorView): number | null {
  const { doc } = view.state
  if (doc.childCount === 0) return null
  const lastIndex = doc.childCount - 1
  const last = doc.child(lastIndex)
  if (!isHardBlockTypeForClickBelow(last.type.name)) return null
  return topLevelNodePosAt(doc, lastIndex)
}

function shouldHandlePointerBelowLastHardBlock(view: EditorView, event: MouseEvent): boolean {
  if (!isPrimaryPointer(event)) return false

  const root = view.dom
  if (!(root instanceof HTMLElement)) return false
  if (!(event.target instanceof Node) || !root.contains(event.target)) return false

  const blockPos = resolveLastTopLevelHardBlockPos(view)
  if (blockPos == null) return false

  const wrap = view.nodeDOM(blockPos)
  if (!(wrap instanceof HTMLElement)) return false
  if (wrap.contains(event.target)) return false

  const rootRect = root.getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()
  if (event.clientX < rootRect.left || event.clientX > rootRect.right) return false
  if (event.clientY <= wrapRect.bottom + 1) return false
  if (event.clientY > rootRect.bottom + 1) return false

  return true
}

export function resolveHardBlockGapInsertPos(
  blocks: readonly {
    readonly type: string
    readonly top: number
    readonly bottom: number
    readonly posAfter: number
    readonly containsTarget: boolean
  }[],
  clientY: number,
): number | null {
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const current = blocks[i]
    const next = blocks[i + 1]
    if (!current || !next) continue
    if (!isHardBlockTypeForClickBelow(current.type) || !isHardBlockTypeForClickBelow(next.type)) continue
    if (current.containsTarget || next.containsTarget) continue
    const seamTop = Math.min(current.bottom, next.top)
    const seamBottom = Math.max(current.bottom, next.top)
    if (clientY > seamTop - 6 && clientY < seamBottom + 6) return current.posAfter
  }
  return null
}

function tryInsertParagraphInHardBlockGap(editor: Editor, view: EditorView, event: MouseEvent): boolean {
  if (!isPrimaryPointer(event)) return false
  const root = view.dom
  if (!(root instanceof HTMLElement)) return false
  if (!(event.target instanceof Node) || !root.contains(event.target)) return false

  const { doc } = view.state
  const blocks: Array<{
    type: string
    top: number
    bottom: number
    posAfter: number
    containsTarget: boolean
  }> = []
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i)
    const pos = topLevelNodePosAt(doc, i)
    const wrap = view.nodeDOM(pos)
    if (!(wrap instanceof HTMLElement)) continue
    const rect = wrap.getBoundingClientRect()
    blocks.push({
      type: child.type.name,
      top: rect.top,
      bottom: rect.bottom,
      posAfter: pos + child.nodeSize,
      containsTarget: wrap.contains(event.target),
    })
  }

  const insertPos = resolveHardBlockGapInsertPos(blocks, event.clientY)
  if (insertPos == null) return false
  return insertEditableParagraphAt(editor, view, insertPos)
}

export function tryFocusParagraphOnHardBlockPointer(
  editor: Editor,
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (tryInsertParagraphInHardBlockGap(editor, view, event)) return true
  if (!shouldHandlePointerBelowLastHardBlock(view, event)) return false
  return insertEditableParagraphAt(editor, view, view.state.doc.content.size)
}

/** @deprecated Use tryFocusParagraphOnHardBlockPointer. */
export function tryFocusParagraphBelowLastCodeBlockOnPointer(
  editor: Editor,
  view: EditorView,
  event: MouseEvent,
): boolean {
  return tryFocusParagraphOnHardBlockPointer(editor, view, event)
}
