import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@codemirror/view'
import {
  selectionTouchesCodeSpecBlock,
  selectionTouchesInlineCodeMark,
} from '../editor/lunaCodeContext'
import { isSelectionInsideTableCell } from '../editor/lunaTableCell'
import { sourceCursorInCodeFence } from '../editor/sourceMarkdownTabContext'

export type EditorPaneMode = 'visual' | 'source'

export type EditorNodeType =
  | 'paragraph'
  | 'heading'
  | 'codeBlock'
  | 'blockquote'
  | 'listItem'
  | 'tableCell'
  | 'unknown'

/**
 * Editor snapshot for command parsing (read-only, no dispatch).
 * It is collected uniformly by menu / shortcut / palette and then passed to resolveCommand.
 */
export type EditorContext = {
  mode: EditorPaneMode
  inCodeBlock: boolean
  inInlineCode: boolean
  inList: boolean
  inHeading: boolean
  headingLevel: number | null
  selectionEmpty: boolean
  nodeType: EditorNodeType
  isReadonly: boolean
  inTable: boolean
}

export function buildNullEditorContext(mode: EditorPaneMode, isReadonly = false): EditorContext {
  return {
    mode,
    inCodeBlock: false,
    inInlineCode: false,
    inList: false,
    inHeading: false,
    headingLevel: null,
    selectionEmpty: true,
    nodeType: 'unknown',
    isReadonly,
    inTable: false,
  }
}

function activeHeadingLevel(editor: Editor): number | null {
  for (let level = 1; level <= 6; level += 1) {
    if (editor.isActive('heading', { level })) return level
  }
  return null
}

function nodeTypeFromVisual(editor: Editor, inCodeBlock: boolean, inHeading: boolean, inTable: boolean): EditorNodeType {
  if (inCodeBlock) return 'codeBlock'
  if (inHeading) return 'heading'
  if (inTable) return 'tableCell'
  if (editor.isActive('blockquote')) return 'blockquote'
  if (editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')) {
    return 'listItem'
  }
  return 'paragraph'
}

export function buildVisualEditorContext(editor: Editor, isReadonly = false): EditorContext {
  const { state } = editor
  const inCodeBlock = selectionTouchesCodeSpecBlock(state)
  const inInlineCode = selectionTouchesInlineCodeMark(state)
  const inTable = isSelectionInsideTableCell(editor)
  const headingLevel = activeHeadingLevel(editor)
  const inHeading = headingLevel != null
  const inList =
    editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')

  return {
    mode: 'visual',
    inCodeBlock,
    inInlineCode,
    inList,
    inHeading,
    headingLevel,
    selectionEmpty: state.selection.empty,
    nodeType: nodeTypeFromVisual(editor, inCodeBlock, inHeading, inTable),
    isReadonly,
    inTable,
  }
}

function parseSourceLineContext(lineText: string): Pick<EditorContext, 'inHeading' | 'headingLevel' | 'inList' | 'nodeType'> {
  const hm = lineText.match(/^(#{1,6})\s/)
  if (hm) {
    return {
      inHeading: true,
      headingLevel: hm[1]!.length,
      inList: false,
      nodeType: 'heading',
    }
  }
  if (/^\s*>\s/.test(lineText)) {
    return { inHeading: false, headingLevel: null, inList: false, nodeType: 'blockquote' }
  }
  if (/^\s*([-*+]|\d+\.)\s/.test(lineText) || /^\s*-\s+\[[ xX]\]\s/.test(lineText)) {
    return { inHeading: false, headingLevel: null, inList: true, nodeType: 'listItem' }
  }
  if (lineText.trimStart().startsWith('```')) {
    return { inHeading: false, headingLevel: null, inList: false, nodeType: 'codeBlock' }
  }
  return { inHeading: false, headingLevel: null, inList: false, nodeType: 'paragraph' }
}

export function buildSourceEditorContext(view: EditorView, isReadonly = false): EditorContext {
  const { from, to } = view.state.selection.main
  const doc = view.state.doc.toString()
  const line = view.state.doc.lineAt(from)
  const lineCtx = parseSourceLineContext(line.text)
  const inCodeBlock = sourceCursorInCodeFence(doc, from)
  const inInlineCode = /`[^`]+`/.test(line.text) && from !== to

  return {
    mode: 'source',
    inCodeBlock,
    inInlineCode,
    inList: lineCtx.inList,
    inHeading: lineCtx.inHeading,
    headingLevel: lineCtx.headingLevel,
    selectionEmpty: from === to,
    nodeType: inCodeBlock ? 'codeBlock' : lineCtx.nodeType,
    isReadonly,
    inTable: /^\s*\|/.test(line.text),
  }
}

/** Build from ProseMirror state (test/no Editor shell)*/
export function buildEditorContextFromPmState(state: EditorState, isReadonly = false): EditorContext {
  const inCodeBlock = selectionTouchesCodeSpecBlock(state)
  const inInlineCode = selectionTouchesInlineCodeMark(state)
  const { $from } = state.selection
  let inTable = false
  for (let d = $from.depth; d > 0; d -= 1) {
    const name = $from.node(d).type.name
    if (name === 'tableCell' || name === 'tableHeader') {
      inTable = true
      break
    }
  }
  let headingLevel: number | null = null
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d)
    if (node.type.name === 'heading') {
      headingLevel = Number(node.attrs.level) || 1
      break
    }
  }
  const inHeading = headingLevel != null
  const inList = (() => {
    for (let d = $from.depth; d > 0; d -= 1) {
      const n = $from.node(d).type.name
      if (n === 'listItem' || n === 'taskItem') return true
    }
    return false
  })()

  let nodeType: EditorNodeType = 'paragraph'
  if (inCodeBlock) nodeType = 'codeBlock'
  else if (inHeading) nodeType = 'heading'
  else if (inTable) nodeType = 'tableCell'
  else if (inList) nodeType = 'listItem'
  else if ($from.parent.type.name === 'blockquote') nodeType = 'blockquote'

  return {
    mode: 'visual',
    inCodeBlock,
    inInlineCode,
    inList,
    inHeading,
    headingLevel,
    selectionEmpty: state.selection.empty,
    nodeType,
    isReadonly,
    inTable,
  }
}

export function isCodeGuardedContext(ctx: EditorContext): boolean {
  return ctx.inCodeBlock || ctx.inInlineCode
}
