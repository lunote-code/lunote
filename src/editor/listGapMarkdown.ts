import { Fragment } from 'prosemirror-model'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'

import { stripLeadingYamlFrontmatter } from './lunaMarkdownExtensionsPreprocess'

/** Invisible marker that terminates CommonMark list continuation across blank lines. */
export const LIST_GAP_MARK = '\u200b'

const LIST_BLOCK_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

export function isListBlockType(typeName: string): boolean {
  return LIST_BLOCK_TYPES.has(typeName)
}

export function isListGapOnlyParagraph(node: ProseMirrorNode): boolean {
  return (
    node.type.name === 'paragraph' &&
    node.childCount === 1 &&
    node.firstChild?.isText === true &&
    node.firstChild.text === LIST_GAP_MARK
  )
}

function fenceToggleLine(line: string): boolean {
  return /^\s*(?:`{3,}|~{3,})\s*[^\n]*$/u.test(line)
}

function isTopLevelOrderedMarker(line: string): { indent: number; marker: number } | null {
  const match = line.match(/^(\s*)(\d+)\.\s/u)
  if (!match) return null
  return { indent: match[1].length, marker: Number.parseInt(match[2] ?? '', 10) }
}

function isTopLevelBulletMarker(line: string): boolean {
  return /^\s*[-+*]\s+(?!\[[ xX]\]\s)/u.test(line) && !/^\s{1,}/u.test(line)
}

function isTopLevelTaskMarker(line: string): boolean {
  return /^\s*[-+*]\s+\[[ xX]\]\s/u.test(line) && !/^\s{1,}/u.test(line)
}

export type TopLevelListRestartGap = {
  readonly splitAfterItemIndex: number
  readonly blankLines: number
}

/**
 * Scan markdown for blank-line-separated list restarts merged by CommonMark.
 * Returns split-after indices (0-based) within the merged top-level list items.
 */
export function findTopLevelListRestartSplitIndices(body: string): number[] {
  return findTopLevelListRestartGaps(body).map((gap) => gap.splitAfterItemIndex)
}

/** Like `findTopLevelListRestartSplitIndices`, but also records blank-line runs before each restart. */
export function findTopLevelListRestartGaps(body: string): TopLevelListRestartGap[] {
  const lines = body.split('\n')
  const gaps: TopLevelListRestartGap[] = []
  let topItemIndex = -1
  let blankRun = 0
  let inFence = false

  for (const line of lines) {
    if (fenceToggleLine(line)) {
      inFence = !inFence
      blankRun = 0
      continue
    }
    if (inFence) continue

    if (line.trim() === '') {
      blankRun += 1
      continue
    }

    const ordered = isTopLevelOrderedMarker(line)
    if (ordered && ordered.indent === 0) {
      if (blankRun > 0 && topItemIndex >= 0 && ordered.marker === 1) {
        gaps.push({ splitAfterItemIndex: topItemIndex, blankLines: blankRun })
      }
      topItemIndex += 1
      blankRun = 0
      continue
    }

    if (blankRun > 0 && topItemIndex >= 0 && (isTopLevelBulletMarker(line) || isTopLevelTaskMarker(line))) {
      gaps.push({ splitAfterItemIndex: topItemIndex, blankLines: blankRun })
      topItemIndex += 1
      blankRun = 0
      continue
    }

    if (!/^\s/u.test(line)) {
      topItemIndex = -1
    }
    blankRun = 0
  }

  return gaps
}

export function shouldWriteListGapMarker(parent: ProseMirrorNode, index: number): boolean {
  const node = parent.child(index)
  if (node.type.name !== 'paragraph') return false
  if (node.content.size > 0 && !isListGapOnlyParagraph(node)) return false
  if (index <= 0 || index >= parent.childCount - 1) return false
  if (!isListBlockType(parent.child(index - 1).type.name)) return false

  let next = index + 1
  while (next < parent.childCount) {
    const sibling = parent.child(next)
    if (sibling.type.name === 'paragraph' && sibling.content.size === 0) {
      next += 1
      continue
    }
    return isListBlockType(sibling.type.name)
  }
  return false
}

function splitListNodeAtIndices(
  list: ProseMirrorNode,
  gaps: readonly TopLevelListRestartGap[],
  schema: Schema,
): ProseMirrorNode[] {
  const sorted = [...gaps].sort((a, b) => a.splitAfterItemIndex - b.splitAfterItemIndex)
  const segments: ProseMirrorNode[] = []
  const para = schema.nodes.paragraph
  let start = 0
  for (const gap of sorted) {
    const end = gap.splitAfterItemIndex + 1
    if (end <= start || end > list.childCount) continue
    segments.push(list.copy(list.content.cut(start, end)))
    if (para && gap.blankLines > 0) {
      for (let i = 0; i < gap.blankLines; i += 1) {
        segments.push(para.create())
      }
    }
    start = end
  }
  if (start < list.childCount) {
    segments.push(list.copy(list.content.cut(start)))
  }
  return segments.length > 0 ? segments : [list]
}

/** Split a single merged top-level list when source markdown shows blank-line-separated restarts. */
export function splitMergedListsAtBlankGaps(
  doc: ProseMirrorNode,
  schema: Schema,
  markdown: string,
): ProseMirrorNode {
  const { body } = stripLeadingYamlFrontmatter(markdown)
  const gaps = findTopLevelListRestartGaps(body)
  if (gaps.length === 0) return doc

  const docType = schema.nodes.doc
  if (!docType) return doc

  const children: ProseMirrorNode[] = []
  let applied = false
  const lastSplit = gaps[gaps.length - 1]?.splitAfterItemIndex ?? -1

  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i)
    if (!applied && isListBlockType(child.type.name) && child.childCount > lastSplit + 1) {
      children.push(...splitListNodeAtIndices(child, gaps, schema))
      applied = true
      continue
    }
    children.push(child)
  }

  return applied ? docType.create(null, Fragment.from(children)) : doc
}

/** Convert invisible list-gap markers back to empty paragraphs for editing. */
export function normalizeListGapParagraphs(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const para = schema.nodes.paragraph
  const docType = schema.nodes.doc
  if (!para || !docType) return doc

  let changed = false
  const children: ProseMirrorNode[] = []
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i)
    if (isListGapOnlyParagraph(child)) {
      children.push(para.create())
      changed = true
      continue
    }
    children.push(child)
  }

  return changed ? docType.create(null, Fragment.from(children)) : doc
}
