import type { EditorView } from '@codemirror/view'

import { NAV_JUMP_VIEWPORT_FRACTION, scrollCodeMirrorViewToPos } from './caretAnchorScroll'
import { canonicalMarkdownOutline } from '../markdown/canonicalMarkdownOutline'

function resolveHeadingDocPos(view: EditorView, headingId: string, fallbackMarkdown?: string): number | null {
  const candidates = [view.state.doc.toString(), fallbackMarkdown].filter(
    (md): md is string => typeof md === 'string' && md.length >= 0,
  )
  const seen = new Set<string>()
  for (const md of candidates) {
    if (seen.has(md)) continue
    seen.add(md)
    const ln = canonicalMarkdownOutline.sourceLineNumberForHeadingId(md, headingId)
    if (ln == null) continue
    try {
      const line = view.state.doc.line(Math.min(Math.max(1, ln), view.state.doc.lines))
      const inLine = canonicalMarkdownOutline.headingContentStartOffsetInLine(line.text)
      return Math.min(line.from + inLine, line.to)
    } catch {
      continue
    }
  }
  return null
}

/** Source code mode sidebar outline: jump by id and flash*/
export function jumpCodeMirrorToOutlineHeading(
  view: EditorView,
  headingId: string,
  fallbackMarkdown?: string,
): boolean {
  if (!headingId) return false
  const pos = resolveHeadingDocPos(view, headingId, fallbackMarkdown)
  if (pos == null) return false
  scrollCodeMirrorViewToPos(view, pos, {
    flash: true,
    anchorFraction: NAV_JUMP_VIEWPORT_FRACTION,
    lineBlockOnly: true,
  })
  return true
}
