import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'

/** Paragraph whose sole inline content is an image atom (Typora-style image block). */
export function isImageOnlyParagraph(node: PMNode): boolean {
  if (node.type.name !== 'paragraph') return false
  if (node.childCount !== 1) return false
  const first = node.firstChild
  return first?.type.name === 'image' && first.isAtom
}

export type EmptyParagraphBelowImageRange = {
  emptyParagraphFrom: number
  emptyParagraphTo: number
  caretAfterImage: number
}

/** Caret at the start of an empty paragraph immediately after an image-only paragraph. */
export function resolveEmptyParagraphBelowImage($from: ResolvedPos): EmptyParagraphBelowImageRange | null {
  const parent = $from.parent
  if (parent.type.name !== 'paragraph' || parent.content.size > 0) return null
  if ($from.parentOffset !== 0) return null
  if ($from.depth < 1) return null

  const indexInParent = $from.index($from.depth - 1)
  if (indexInParent <= 0) return null

  const container = $from.node($from.depth - 1)
  const prevBlock = container.child(indexInParent - 1)
  if (!isImageOnlyParagraph(prevBlock)) return null

  const emptyFrom = $from.before($from.depth)
  const emptyTo = $from.after($from.depth)
  return {
    emptyParagraphFrom: emptyFrom,
    emptyParagraphTo: emptyTo,
    caretAfterImage: emptyFrom - 1,
  }
}

/** Caret at the end of an image-only paragraph (inline position after the image node). */
export function isCaretAfterImageInImageOnlyParagraph($from: ResolvedPos): boolean {
  const parent = $from.parent
  if (!isImageOnlyParagraph(parent)) return false
  if ($from.parentOffset !== parent.content.size) return false
  return $from.nodeBefore?.type.name === 'image'
}

/** Caret at the start of a paragraph immediately after the empty spacer below an image. */
export function resolveParagraphAfterImageSpacer($from: ResolvedPos): EmptyParagraphBelowImageRange | null {
  const parent = $from.parent
  if (parent.type.name !== 'paragraph' || parent.content.size === 0) return null
  if ($from.parentOffset !== 0) return null
  if ($from.depth < 1) return null

  const indexInParent = $from.index($from.depth - 1)
  if (indexInParent < 2) return null

  const container = $from.node($from.depth - 1)
  const spacer = container.child(indexInParent - 1)
  const imageBlock = container.child(indexInParent - 2)
  if (spacer.type.name !== 'paragraph' || spacer.content.size > 0) return null
  if (!isImageOnlyParagraph(imageBlock)) return null

  const emptyFrom = $from.before($from.depth) - spacer.nodeSize
  return {
    emptyParagraphFrom: emptyFrom,
    emptyParagraphTo: emptyFrom + spacer.nodeSize,
    caretAfterImage: emptyFrom - 1,
  }
}

/** Caret at the start of an image-only paragraph (before the image atom). */
export function isCaretBeforeImageInImageOnlyParagraph($from: ResolvedPos): boolean {
  const parent = $from.parent
  if (!isImageOnlyParagraph(parent)) return false
  return $from.parentOffset === 0 && $from.nodeBefore == null
}

export function isEmptyParagraphNode(node: PMNode): boolean {
  return node.type.name === 'paragraph' && node.content.size === 0
}

/** PM position immediately after the image atom inside an image-only paragraph. */
export function imageParagraphAfterImagePos(doc: PMNode, imageParagraphPos: number): number {
  const node = doc.nodeAt(imageParagraphPos)
  if (!node || !isImageOnlyParagraph(node)) return imageParagraphPos + 1
  return imageParagraphPos + 1 + node.content.size
}

/** PM position at the start of inline content inside an image-only paragraph. */
export function imageParagraphBeforeImagePos(imageParagraphPos: number): number {
  return imageParagraphPos + 1
}
