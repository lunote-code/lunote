import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { resolveInlineMarkRevealRange } from './lunaMarkdownSourceReveal'

const PLUGIN_KEY = new PluginKey('lunaParagraphDoubleClickWordSelect')

const WORD_CHAR = /[\p{L}\p{N}_]/u

type InlineLineSegment = {
  from: number
  text: string
}

/** Split a textblock's inline content into visual lines separated by hard breaks. */
function collectInlineLineSegments(parent: PMNode): InlineLineSegment[] {
  if (!parent.isTextblock) return []

  const segments: InlineLineSegment[] = []
  let offset = 0
  let segFrom = 0
  let segText = ''

  const pushSegment = () => {
    if (!segText) return
    segments.push({ from: segFrom, text: segText })
    segText = ''
  }

  parent.forEach((child) => {
    if (child.type.name === 'hardBreak') {
      pushSegment()
      offset += 1
      segFrom = offset
      return
    }
    if (child.isText) {
      const chunk = child.text ?? ''
      if (!segText) segFrom = offset
      segText += chunk
      offset += chunk.length
      return
    }
    pushSegment()
    offset += child.nodeSize
    segFrom = offset
  })

  pushSegment()
  return segments
}

function resolveInlineLineSegment(
  segments: InlineLineSegment[],
  parentOffset: number,
): InlineLineSegment | null {
  if (segments.length === 0) return null

  for (const segment of segments) {
    const end = segment.from + segment.text.length
    if (parentOffset >= segment.from && parentOffset <= end) return segment
  }

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (parentOffset >= segments[i].from) return segments[i]
  }

  return segments[0] ?? null
}

function isVisuallyEmptyParagraph(node: PMNode): boolean {
  if (node.type.name !== 'paragraph') return false
  if (node.content.size === 0) return true
  if (node.childCount === 1 && node.firstChild?.type.name === 'hardBreak') return true
  return false
}

function findWordBoundsInParent(doc: PMNode, pos: number): { from: number; to: number } | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(clamped)
  if (!$pos.parent.isTextblock) return null

  const segments = collectInlineLineSegments($pos.parent)
  const segment = resolveInlineLineSegment(segments, $pos.parentOffset)
  if (!segment || !segment.text.length) return null

  const text = segment.text
  let offset = $pos.parentOffset - segment.from
  if (offset >= text.length) offset = text.length - 1
  if (offset < 0) offset = 0

  if (!WORD_CHAR.test(text[offset] ?? '')) {
    let probe = offset
    while (probe > 0 && !WORD_CHAR.test(text[probe - 1] ?? '')) probe -= 1
    if (!WORD_CHAR.test(text[probe] ?? '')) return null
    offset = probe
  }

  let from = offset
  let to = offset + 1
  while (from > 0 && WORD_CHAR.test(text[from - 1] ?? '')) from -= 1
  while (to < text.length && WORD_CHAR.test(text[to] ?? '')) to += 1
  if (from >= to) return null

  const base = $pos.start()
  return { from: base + segment.from + from, to: base + segment.from + to }
}

function resolveDoubleClickProbePos(doc: PMNode, view: EditorView, event: MouseEvent): number | null {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!coords) return null

  const pos = coords.pos
  const $pos = doc.resolve(pos)

  if ($pos.parent.type.name === 'paragraph' && isVisuallyEmptyParagraph($pos.parent)) {
    const prev = Math.max(0, pos - 1)
    const $prev = doc.resolve(prev)
    if ($prev.parent.isTextblock && $prev.parent.textContent.length > 0) {
      return $prev.pos
    }
  }

  if (
    $pos.parent.isTextblock &&
    $pos.parentOffset === 0 &&
    pos > $pos.start() &&
    $pos.nodeBefore == null
  ) {
    const prev = Math.max(0, pos - 1)
    const $prev = doc.resolve(prev)
    if ($prev.parent.isTextblock && $prev.parent.textContent.length > 0) {
      return $prev.pos
    }
  }

  if ($pos.parent.isTextblock && $pos.nodeBefore?.type.name === 'hardBreak') {
    const segments = collectInlineLineSegments($pos.parent)
    const index = segments.findIndex((segment) => segment.from === $pos.parentOffset)
    if (index > 0) {
      const previous = segments[index - 1]
      if (previous.text.length > 0) {
        return $pos.start() + previous.from + previous.text.length - 1
      }
    }
  }

  if ($pos.parent.isTextblock) {
    const segments = collectInlineLineSegments($pos.parent)
    const segment = resolveInlineLineSegment(segments, $pos.parentOffset)
    if (segment && $pos.parentOffset > segment.from + segment.text.length) {
      return $pos.start() + segment.from + Math.max(0, segment.text.length - 1)
    }
  }

  if (
    $pos.parent.isTextblock &&
    $pos.parent.content.size > 0 &&
    $pos.parentOffset >= $pos.parent.content.size
  ) {
    const segments = collectInlineLineSegments($pos.parent)
    const last = segments[segments.length - 1]
    if (last?.text.length) {
      return $pos.start() + last.from + last.text.length - 1
    }
    return Math.max($pos.start(), pos - 1)
  }

  return pos
}

function shouldSkipDoubleClickWordSelectTarget(target: HTMLElement | null): boolean {
  if (target?.closest('.pm-code-block-wrap, [data-luna-code-block-wrap]')) return true
  if (
    target?.closest(
      'blockquote, .pm-heading-block, .pm-footnote-def-wrap, .pm-link-reference-def',
    )
  ) {
    return true
  }
  return false
}

function shouldDeferToMarkdownSourceReveal(view: EditorView, event: MouseEvent): boolean {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  const pos = coords?.pos
  if (pos != null && resolveInlineMarkRevealRange(view.state.doc, pos)) return true
  const probePos = resolveDoubleClickProbePos(view.state.doc, view, event)
  if (probePos == null) return false
  return resolveInlineMarkRevealRange(view.state.doc, probePos) != null
}

/**
 * Apply custom word selection for a double-click gesture.
 * Returns true when the event was handled (caller should preventDefault).
 */
function handleParagraphDoubleClickWordSelect(view: EditorView, event: MouseEvent): boolean {
  if (view.composing) return false
  const target = event.target as HTMLElement | null
  if (shouldSkipDoubleClickWordSelectTarget(target)) return false
  if (shouldDeferToMarkdownSourceReveal(view, event)) return false

  const probePos = resolveDoubleClickProbePos(view.state.doc, view, event)
  if (probePos == null) return false

  const bounds = findWordBoundsInParent(view.state.doc, probePos)
  if (!bounds) return false

  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, bounds.from, bounds.to)),
  )
  return true
}

export const LunaParagraphDoubleClickWordSelect = Extension.create({
  name: 'lunaParagraphDoubleClickWordSelect',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          handleDOMEvents: {
            /**
             * Run on the second mousedown (detail===2) before the browser paints its
             * default word/line selection — avoids a one-frame flash of empty-paragraph
             * highlight when double-clicking near a blank line below.
             */
            mousedown(view, event) {
              if (event.button !== 0 || event.detail !== 2) return false
              if (!handleParagraphDoubleClickWordSelect(view, event)) return false
              event.preventDefault()
              return true
            },
            dblclick(view, event) {
              if (view.composing) return false
              const target = event.target as HTMLElement | null
              if (shouldSkipDoubleClickWordSelectTarget(target)) return false
              if (handleParagraphDoubleClickWordSelect(view, event)) {
                event.preventDefault()
                return true
              }
              return false
            },
          },
        },
      }),
    ]
  },
})
