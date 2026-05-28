import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import { spanStyleColorTag } from './lunaInlineHtmlMarkLift'
import { normalizeTextColor } from './lunaTextColor'

export const surroundSelection = (left: string, right = left) => (view: EditorView) => {
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to)
  const insert = `${left}${selected}${right}`
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(from + left.length, from + left.length + selected.length),
  })
  return true
}

const SPAN_COLOR_OPEN_RE = /<span\b[^>]*\bstyle\s*=\s*["'][^"']*color\s*:[^"']*["'][^>]*>/giu

export function applySourceTextColor(view: EditorView, color: string | null): boolean {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  const selected = view.state.doc.sliceString(from, to)
  if (color === null) {
    const stripped = selected.replace(SPAN_COLOR_OPEN_RE, '').replace(/<\/span>/giu, '')
    if (stripped === selected) return false
    view.dispatch({
      changes: { from, to, insert: stripped },
      selection: EditorSelection.range(from, from + stripped.length),
    })
    return true
  }
  const open = spanStyleColorTag(color)
  if (!open) return false
  const insert = `${open}${selected}</span>`
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(from + open.length, from + open.length + selected.length),
  })
  return true
}

export function isValidSourceTextColor(color: string | null): boolean {
  return color === null || normalizeTextColor(color) != null
}

const OL_ITEM_RE = /^(\s*)(\d+)\.\s(.*)$/

export const isMarkdownTaskLine = (s: string) => /^\s*-\s+\[[ xX]\]\s/.test(s)
export const isMarkdownUlBulletLine = (s: string) => /^\s*-\s/.test(s) && !isMarkdownTaskLine(s)

export const insertPrefixLine = (prefix: string) => (view: EditorView) => {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const text = line.text

  if (prefix === '- ' && isMarkdownUlBulletLine(text)) {
    const indent = text.match(/^(\s*)/)?.[1] ?? ''
    const insert = `\n${indent}- `
    view.dispatch({
      changes: { from: line.to, insert },
      selection: EditorSelection.cursor(line.to + insert.length),
    })
    return true
  }

  if (prefix === '1. ') {
    const m = text.match(OL_ITEM_RE)
    if (m) {
      const indent = m[1]
      const n = parseInt(m[2], 10)
      const insert = `\n${indent}${n + 1}. `
      view.dispatch({
        changes: { from: line.to, insert },
        selection: EditorSelection.cursor(line.to + insert.length),
      })
      return true
    }
  }

  view.dispatch({
    changes: { from: line.from, to: line.from + text.length, insert: `${prefix}${text}` },
    selection: EditorSelection.cursor(from + prefix.length),
  })
  return true
}

const BARE_URL_RE = /^https?:\/\/\S+$/i

export const insertMarkdownLink = (view: EditorView) => {
  const { from, to } = view.state.selection.main
  const sel = view.state.doc.sliceString(from, to)
  if (sel) {
    const url = sel.trim()
    if (BARE_URL_RE.test(url)) {
      const insert = `[](${url})`
      view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.cursor(from + 1),
      })
      return true
    }
    return surroundSelection('[', '](https://)')(view)
  }
  const insert = '[](https://)'
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + 1),
  })
  return true
}

/** Markdown link reference definition `[label]: url` (non-inline hyperlink)*/
export const insertMarkdownReferenceDef = (view: EditorView) => {
  const { head } = view.state.selection.main
  const line = view.state.doc.lineAt(head)
  const lineText = line.text.trim()
  const insert = lineText.length > 0 ? `\n[]: https://` : `[]: https://`
  const pos = lineText.length > 0 ? line.to : line.from
  const cursorInLabel = insert.indexOf('[') + 1
  view.dispatch({
    changes: { from: pos, insert },
    selection: EditorSelection.cursor(pos + cursorInLabel),
  })
  return true
}

export const insertMarkdownImage = (view: EditorView) => {
  const { from, to } = view.state.selection.main
  const sel = view.state.doc.sliceString(from, to)
  if (sel) {
    return surroundSelection('![', '](./image.png)')(view)
  }
  const path = './image.png'
  const insert = `![](${path})`
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(from + 4, from + 4 + path.length),
  })
  return true
}

/** GFM table skeleton (column names can be changed)*/
export const insertMarkdownTable = (view: EditorView) => {
  const pos = view.state.selection.main.head
  const insert = '\n| Col 1 | Col 2 |\n| --- | --- |\n|  |  |\n'
  view.dispatch({
    changes: { from: pos, insert },
    selection: EditorSelection.cursor(pos + 3),
  })
  return true
}

export const insertCodeFenceForLang = (lang: string) => (view: EditorView) => {
  const open = `\`\`\`${lang}\n`
  const close = '\n```'
  return surroundSelection(open, close)(view)
}
