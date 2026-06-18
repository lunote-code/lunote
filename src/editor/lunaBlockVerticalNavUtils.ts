import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import {
  imageParagraphAfterImagePos,
  isCaretAfterImageInImageOnlyParagraph,
  isCaretBeforeImageInImageOnlyParagraph,
  isEmptyParagraphNode,
  isImageOnlyParagraph,
  resolveEmptyParagraphBelowImage,
  resolveParagraphAfterImageSpacer,
} from './lunaImageParagraphUtils'

/** Caret at the vertical edge of an inline textblock (line start/end). */
export function isAtTextblockVerticalBoundary($from: ResolvedPos, dir: 'up' | 'down'): boolean {
  if (!$from.parent.isTextblock) return false
  if (isEmptyParagraphNode($from.parent)) return true
  return dir === 'down'
    ? $from.parentOffset === $from.parent.content.size
    : $from.parentOffset === 0
}

function isSameVisualLine(view: EditorView, aPos: number, bPos: number): boolean {
  try {
    const a = view.coordsAtPos(clampPos(view.state.doc, aPos))
    const b = view.coordsAtPos(clampPos(view.state.doc, bPos))
    return Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1
  } catch {
    return false
  }
}

function isAtTextblockVisualBoundary(
  $from: ResolvedPos,
  dir: 'up' | 'down',
  view?: EditorView | null,
): boolean {
  if (!view || !$from.parent.isTextblock) return false
  const edgePos = dir === 'down' ? $from.end() : $from.start()
  return isSameVisualLine(view, $from.pos, edgePos)
}

function boundaryPosAtDepth($from: ResolvedPos, depth: number, dir: 'up' | 'down'): number | null {
  if (depth < 0 || depth > $from.depth) return null
  if (depth === 0) return dir === 'down' ? $from.doc.content.size : 0
  try {
    return dir === 'down' ? $from.after(depth) : $from.before(depth)
  } catch {
    return null
  }
}

/** Walk ancestor boundaries to find a sibling code block (listItem / list / doc aware). */
export function findAdjacentCodeBlockPos(
  $from: ResolvedPos,
  dir: 'up' | 'down',
  view?: EditorView | null,
): number | null {
  if (!$from.parent.isTextblock) return null
  if (!isEmptyParagraphNode($from.parent)) {
    if (dir === 'down') {
      if (
        $from.parentOffset !== $from.parent.content.size &&
        !isAtTextblockVisualBoundary($from, dir, view)
      ) {
        return null
      }
    } else if ($from.parentOffset !== 0 && !isAtTextblockVisualBoundary($from, dir, view)) {
      return null
    }
  }

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const boundary = boundaryPosAtDepth($from, depth, dir)
    if (boundary == null) continue
    if (boundary < 0 || boundary > $from.doc.content.size) continue
    const $boundary = $from.doc.resolve(boundary)
    const node = dir === 'down' ? $boundary.nodeAfter : $boundary.nodeBefore
    if (node?.type.name === 'codeBlock') {
      return dir === 'down' ? $boundary.pos : $boundary.pos - node.nodeSize
    }
    if (node != null) continue
  }
  return null
}

function selectionNearBlock(
  doc: PMNode,
  pos: number,
  dir: -1 | 1,
): Selection | null {
  try {
    return Selection.near(doc.resolve(pos), dir)
  } catch {
    return null
  }
}

function clampPos(doc: PMNode, pos: number): number {
  return Math.max(0, Math.min(pos, doc.content.size))
}

function textSelection(doc: PMNode, pos: number): TextSelection {
  return TextSelection.create(doc, clampPos(doc, pos))
}

function nodePosFromBoundary(
  $boundary: ResolvedPos,
  node: PMNode,
  dir: 'up' | 'down',
): number {
  return dir === 'down' ? $boundary.pos : $boundary.pos - node.nodeSize
}

function resolveNavAcrossImageParagraph(
  doc: PMNode,
  imageParagraphPos: number,
  dir: 'up' | 'down',
): Selection | null {
  const afterImage = imageParagraphAfterImagePos(doc, imageParagraphPos)
  if (dir === 'down') {
    return textSelection(doc, afterImage)
  }

  const before = Selection.findFrom(doc.resolve(imageParagraphPos), -1, true)
  if (before) return before
  return textSelection(doc, afterImage)
}

function childBlockPos(containerPos: number, container: PMNode, index: number): number {
  let pos = containerPos + 1
  for (let i = 0; i < index; i += 1) {
    pos += container.child(i).nodeSize
  }
  return pos
}

function selectionAtEndOfContainer(doc: PMNode, containerPos: number, container: PMNode): Selection | null {
  for (let i = container.childCount - 1; i >= 0; i -= 1) {
    const child = container.child(i)
    const childPos = childBlockPos(containerPos, container, i)
    if (isImageOnlyParagraph(child)) {
      return textSelection(doc, imageParagraphAfterImagePos(doc, childPos))
    }
    if (isEmptyParagraphNode(child)) {
      continue
    }
    if (child.isTextblock) {
      return textSelection(doc, childPos + child.nodeSize - 1)
    }
    const nested = selectionAtEndOfContainer(doc, childPos, child)
    if (nested) return nested
  }
  return null
}

function selectionAtStartOfContainer(doc: PMNode, containerPos: number, container: PMNode): Selection | null {
  for (let i = 0; i < container.childCount; i += 1) {
    const child = container.child(i)
    const childPos = childBlockPos(containerPos, container, i)
    if (isEmptyParagraphNode(child)) {
      continue
    }
    if (isImageOnlyParagraph(child)) {
      return textSelection(doc, imageParagraphAfterImagePos(doc, childPos))
    }
    if (child.isTextblock) {
      return textSelection(doc, childPos + 1)
    }
    const nested = selectionAtStartOfContainer(doc, childPos, child)
    if (nested) return nested
  }
  return null
}

function resolveNavAcrossEmptyParagraph(
  doc: PMNode,
  emptyParagraphPos: number,
  dir: 'up' | 'down',
): Selection | null {
  const node = doc.nodeAt(emptyParagraphPos)
  if (!node || !isEmptyParagraphNode(node)) return null

  if (dir === 'up') {
    const $before = doc.resolve(emptyParagraphPos)
    const prev = $before.nodeBefore
    if (prev && isImageOnlyParagraph(prev)) {
      return textSelection(doc, imageParagraphAfterImagePos(doc, emptyParagraphPos - prev.nodeSize))
    }
  }

  // Move into this adjacent empty paragraph only; do not skip consecutive blank lines.
  return textSelection(doc, emptyParagraphPos + 1)
}

function resolveImageSeatedNav($from: ResolvedPos, dir: 'up' | 'down'): Selection | null {
  const below = resolveEmptyParagraphBelowImage($from)
  if (below) {
    if (dir === 'up') return textSelection($from.doc, below.caretAfterImage)
    const indexInParent = $from.index($from.depth - 1)
    const container = $from.node($from.depth - 1)
    if (indexInParent + 1 < container.childCount) {
      return textSelection($from.doc, below.emptyParagraphTo)
    }
    return findVerticalNavFromBoundary($from, dir, { allowBoundarySkip: true })
  }

  const afterSpacer = resolveParagraphAfterImageSpacer($from)
  if (afterSpacer && dir === 'up') {
    return textSelection($from.doc, afterSpacer.emptyParagraphFrom)
  }

  if (isCaretAfterImageInImageOnlyParagraph($from)) {
    return findVerticalNavFromBoundary($from, dir, { allowBoundarySkip: true })
  }

  if (isCaretBeforeImageInImageOnlyParagraph($from)) {
    if (dir === 'up') {
      return findVerticalNavFromBoundary($from, dir, { allowBoundarySkip: true })
    }
    return textSelection($from.doc, imageParagraphAfterImagePos($from.doc, $from.before($from.depth)))
  }

  return null
}

function findVerticalNavFromBoundary(
  $from: ResolvedPos,
  dir: 'up' | 'down',
  opts?: { allowBoundarySkip?: boolean },
): Selection | null {
  const step = dir === 'down' ? 1 : -1
  const doc = $from.doc

  if (!opts?.allowBoundarySkip && !isAtTextblockVerticalBoundary($from, dir)) return null
  if (findAdjacentCodeBlockPos($from, dir) != null) return null

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const boundary = boundaryPosAtDepth($from, depth, dir)
    if (boundary == null) continue
    if (boundary < 0 || boundary > doc.content.size) continue
    const $boundary = doc.resolve(boundary)
    const node = dir === 'down' ? $boundary.nodeAfter : $boundary.nodeBefore
    if (!node) continue
    if (node.type.name === 'codeBlock') return null

    if (isImageOnlyParagraph(node)) {
      return resolveNavAcrossImageParagraph(doc, nodePosFromBoundary($boundary, node, dir), dir)
    }

    if (isEmptyParagraphNode(node)) {
      const nav = resolveNavAcrossEmptyParagraph(doc, nodePosFromBoundary($boundary, node, dir), dir)
      if (nav) return nav
      continue
    }

    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      const itemPos = dir === 'down' ? boundary : boundary - node.nodeSize
      const inner =
        dir === 'down'
          ? selectionAtStartOfContainer(doc, itemPos, node)
          : selectionAtEndOfContainer(doc, itemPos, node)
      if (inner) return inner
      continue
    }

    const found = Selection.findFrom($boundary, step, true)
    if (found) return found

    if (node.isTextblock) {
      return textSelection(doc, dir === 'down' ? boundary : boundary - 1)
    }

    const near =
      dir === 'down'
        ? selectionNearBlock(doc, boundary + 1, 1)
        : selectionNearBlock(doc, boundary, -1)
    if (near) return near

    continue
  }

  const fallbackBoundary = boundaryPosAtDepth($from, $from.depth, dir)
  if (fallbackBoundary == null) return null
  const fallbackFrom = doc.resolve(fallbackBoundary)
  return Selection.findFrom(fallbackFrom, step, true)
}

function findVerticalNavFromPosition(
  doc: PMNode,
  pos: number,
  dir: 'up' | 'down',
): Selection | null {
  const clamped = clampPos(doc, pos)
  const $pos = doc.resolve(clamped)
  const step = dir === 'down' ? 1 : -1
  const found = Selection.findFrom($pos, step, true)
  if (found) return found
  return selectionNearBlock(doc, clamped, step)
}

/** Unified ArrowUp/ArrowDown target across lists, images, paragraphs, and other blocks. */
export function resolveVerticalNavTarget(
  sel: Selection,
  dir: 'up' | 'down',
): Selection | null {
  const doc = sel.$from.doc

  if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
    return findVerticalNavFromPosition(doc, dir === 'down' ? sel.to : sel.from, dir)
  }

  if (!(sel instanceof TextSelection) || !sel.empty) return null

  const $from = sel.$from
  const imageSeated = resolveImageSeatedNav($from, dir)
  if (imageSeated && !imageSeated.eq(sel)) return imageSeated

  const crossBlock = findVerticalNavFromBoundary($from, dir)
  if (crossBlock && !crossBlock.eq(sel)) return crossBlock

  return null
}

/** @deprecated Use resolveVerticalNavTarget. */
export function resolveCrossBlockVerticalNav($from: ResolvedPos, dir: 'up' | 'down'): Selection | null {
  return findVerticalNavFromBoundary($from, dir)
}
