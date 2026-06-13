import type { EditorState } from '@tiptap/pm/state'

export type CaretStructuralProbe = {
  parentType: string
  parentOffset: number
  parentTextLength: number
  inListItem: boolean
  listItemDepth: number | null
  enclosingListType: 'bulletList' | 'orderedList' | 'taskList' | null
  isEmptyTextblock: boolean
  /** PM: empty paragraph as direct doc child immediately after a list block. */
  orphanEmptyParagraphAfterList: boolean
  /** PM: caret parent is not an inline textblock (e.g. listItem boundary). */
  selectionNotInInlineContent: boolean
  domCaretLeftPx: number | null
  nearestListMarkerLeftPx: number | null
  /** DOM caret flush-left while a list marker sits indented to the right. */
  visualOrphanAfterList: boolean
}

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

function findListItemDepth($from: EditorState['selection']['$from']): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'listItem' || $from.node(depth).type.name === 'taskItem') {
      return depth
    }
  }
  return null
}

function readEnclosingListType($from: EditorState['selection']['$from']): CaretStructuralProbe['enclosingListType'] {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
      return name
    }
  }
  return null
}

function isOrphanEmptyParagraphAfterList($from: EditorState['selection']['$from']): boolean {
  const parent = $from.parent
  if (parent.type.name !== 'paragraph' || parent.content.size > 0) return false

  const paragraphDepth = $from.depth - 1
  if (paragraphDepth < 1) return false
  if ($from.node(paragraphDepth - 1).type.name !== 'doc') return false

  const indexInDoc = $from.index(paragraphDepth - 1)
  if (indexInDoc <= 0) return false
  const prev = $from.node(paragraphDepth - 1).child(indexInDoc - 1)
  return LIST_TYPES.has(prev.type.name)
}

function selectionNotInInlineContent($from: EditorState['selection']['$from']): boolean {
  if (!$from.parent.isTextblock) return true
  if ($from.parent.inlineContent && $from.parentOffset <= $from.parent.content.size) return false
  return true
}

function readDomCaretLeft(): number | null {
  if (typeof window === 'undefined') return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return sel.getRangeAt(0).getBoundingClientRect().left
}

function readNearestListMarkerLeft(root: ParentNode): number | null {
  if (typeof document === 'undefined') return null
  const host =
    root instanceof Element ? root : (document.querySelector('.ProseMirror') as HTMLElement | null)
  if (!host) return null
  const items = host.querySelectorAll('ol.pm-editor-list li, ul.pm-editor-list li')
  if (items.length === 0) return null
  const last = items.item(items.length - 1) as HTMLElement
  return last.getBoundingClientRect().left
}

/** Inspect PM + DOM caret context for list / orphan-paragraph regressions. */
export function probeCaretStructuralContext(
  state: EditorState,
  domRoot?: ParentNode | null,
): CaretStructuralProbe {
  const $from = state.selection.$from
  const listItemDepth = findListItemDepth($from)
  const orphanEmptyParagraphAfterList = isOrphanEmptyParagraphAfterList($from)
  const domCaretLeftPx = readDomCaretLeft()
  const nearestListMarkerLeftPx = domRoot ? readNearestListMarkerLeft(domRoot) : null
  const visualOrphanAfterList =
    orphanEmptyParagraphAfterList &&
    domCaretLeftPx != null &&
    nearestListMarkerLeftPx != null &&
    domCaretLeftPx + 4 < nearestListMarkerLeftPx

  return {
    parentType: $from.parent.type.name,
    parentOffset: $from.parentOffset,
    parentTextLength: $from.parent.content.size,
    inListItem: listItemDepth != null,
    listItemDepth,
    enclosingListType: readEnclosingListType($from),
    isEmptyTextblock: $from.parent.isTextblock && $from.parent.content.size === 0,
    orphanEmptyParagraphAfterList,
    selectionNotInInlineContent: selectionNotInInlineContent($from),
    domCaretLeftPx,
    nearestListMarkerLeftPx,
    visualOrphanAfterList,
  }
}

/** After continuing a non-empty list item, caret must stay inside the list. */
export function caretViolatesListContinuationExpectation(probe: CaretStructuralProbe): boolean {
  return probe.orphanEmptyParagraphAfterList || probe.visualOrphanAfterList || probe.selectionNotInInlineContent
}
