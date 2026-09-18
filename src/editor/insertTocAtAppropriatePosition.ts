import { NodeSelection } from '@tiptap/pm/state'
import { Transform } from '@tiptap/pm/transform'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export const TOC_MARKER_LINE = /^\s*\[toc\]\s*$/iu

export type AppropriateTocPlacement =
  | { kind: 'insert'; lineIndex: number }
  | { kind: 'focus-existing'; lineIndex: number }

/** Resolve where `[toc]` should go in Markdown source (0-based line index). */
export function resolveAppropriateTocPlacementInMarkdown(markdown: string): AppropriateTocPlacement {
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    if (TOC_MARKER_LINE.test(lines[i] ?? '')) {
      return { kind: 'focus-existing', lineIndex: i }
    }
  }

  let firstHeadingLine = -1
  let firstH1Line = -1
  for (let i = 0; i < lines.length; i += 1) {
    const match = (lines[i] ?? '').match(/^(#{1,6})\s+\S/u)
    if (!match) continue
    if (firstHeadingLine < 0) firstHeadingLine = i
    if (match[1]?.length === 1 && firstH1Line < 0) firstH1Line = i
  }

  const anchorLine = firstH1Line >= 0 ? firstH1Line : firstHeadingLine
  return { kind: 'insert', lineIndex: anchorLine >= 0 ? anchorLine + 1 : 0 }
}

export function insertTocLineInMarkdown(markdown: string): {
  markdown: string
  result: 'inserted' | 'focused-existing'
  lineIndex: number
} {
  const placement = resolveAppropriateTocPlacementInMarkdown(markdown)
  if (placement.kind === 'focus-existing') {
    return { markdown, result: 'focused-existing', lineIndex: placement.lineIndex }
  }

  const lines = markdown.split('\n')
  const insertAt = Math.min(Math.max(0, placement.lineIndex), lines.length)
  const next = [...lines.slice(0, insertAt), '[toc]', ...lines.slice(insertAt)]
  return {
    markdown: next.join('\n'),
    result: 'inserted',
    lineIndex: insertAt,
  }
}

export function lineStartOffsetInText(text: string, lineIndex: number): number {
  if (lineIndex <= 0) return 0
  let offset = 0
  for (let i = 0; i < lineIndex; i += 1) {
    const lineEnd = text.indexOf('\n', offset)
    if (lineEnd < 0) return text.length
    offset = lineEnd + 1
  }
  return offset
}

export type AppropriateTocInsertPos =
  | { kind: 'insert'; pos: number }
  | { kind: 'focus-existing'; pos: number }

/** Resolve where a `tocDirective` node should go in a PM document. */
export function resolveAppropriateTocInsertPos(doc: PMNode): AppropriateTocInsertPos {
  let existingTocPos: number | null = null
  let firstHeadingEnd: number | null = null
  let firstH1End: number | null = null

  doc.forEach((node, offset) => {
    if (node.type.name === 'tocDirective') {
      if (existingTocPos == null) existingTocPos = offset
      return
    }
    if (node.type.name !== 'heading') return
    const end = offset + node.nodeSize
    if (firstHeadingEnd == null) firstHeadingEnd = end
    if (Number(node.attrs.level) === 1 && firstH1End == null) firstH1End = end
  })

  if (existingTocPos != null) {
    return { kind: 'focus-existing', pos: existingTocPos }
  }

  return { kind: 'insert', pos: firstH1End ?? firstHeadingEnd ?? 1 }
}

export function insertTocAtAppropriatePositionInDoc(
  doc: PMNode,
  schema: Schema,
): { doc: PMNode; result: 'inserted' | 'focus-existing'; pos: number } | null {
  const tocType = schema.nodes.tocDirective
  if (!tocType) return null

  const placement = resolveAppropriateTocInsertPos(doc)
  if (placement.kind === 'focus-existing') {
    return { doc, result: 'focus-existing', pos: placement.pos }
  }

  const tocNode = tocType.create()
  const tr = new Transform(doc).insert(placement.pos, tocNode)
  return {
    doc: tr.doc,
    result: 'inserted',
    pos: placement.pos,
  }
}

export function selectionForTocPos(doc: PMNode, pos: number) {
  const node = doc.nodeAt(pos)
  if (node?.type.name === 'tocDirective') {
    return NodeSelection.create(doc, pos)
  }
  return null
}

export function applyTocInsertInSourceView(view: EditorView): 'inserted' | 'focused-existing' {
  const source = view.state.doc.toString()
  const placement = resolveAppropriateTocPlacementInMarkdown(source)
  if (placement.kind === 'focus-existing') {
    const from = lineStartOffsetInText(source, placement.lineIndex)
    const line = source.split('\n')[placement.lineIndex] ?? '[toc]'
    view.dispatch({
      selection: EditorSelection.range(from, from + line.length),
      scrollIntoView: true,
    })
    return 'focused-existing'
  }

  const next = insertTocLineInMarkdown(source)
  const from = lineStartOffsetInText(next.markdown, next.lineIndex)
  view.dispatch({
    changes: { from: 0, to: source.length, insert: next.markdown },
    selection: EditorSelection.range(from, from + '[toc]'.length),
    scrollIntoView: true,
  })
  return 'inserted'
}
