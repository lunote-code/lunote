import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { defaultKeymap, indentWithTab, undo, redo } from '@codemirror/commands'
import { keymap, EditorView, scrollPastEnd } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { createVmCmRecorder } from '../../vm/vmCmRecorder'
import { createCodeMirrorSearchExtensions } from '../../editor/search/editorSearchBindings'

export const markdownUxKeymap: Extension = keymap.of([
  { key: 'Enter', run: insertNewlineContinueMarkup },
])

export const writerBaseExtensions: Extension[] = [
  // history() intentionally removed — VM transaction log is the sole undo authority
  // VmCmRecorder: captures ALL CM transactions (typing, paste, structured ops) for undo/redo
  createVmCmRecorder(),
  scrollPastEnd(),
  ...createCodeMirrorSearchExtensions(),
  keymap.of([...defaultKeymap.filter((b) => b !== undo && b !== redo), indentWithTab]),
]

export const comfortableEditorTheme = EditorView.theme({
  '&': {
    fontSize: 'var(--editor-content-font-size, 17px)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--code-gutter-bg, var(--surface-panel))',
    color: 'var(--code-gutter-fg, var(--text-muted))',
    border: '0 solid var(--border-subtle)',
  },
  '.cm-gutters.cm-gutters-before': {
    borderRightWidth: '1px',
  },
  '.cm-content': {
    fontFamily: 'var(--editor-content-font-family, var(--font-content))',
    fontSize: 'var(--editor-content-font-size, var(--size-body))',
    lineHeight: 'var(--line-content)',
    letterSpacing: '0.015em',
    padding: '28px clamp(18px, 4vw, 40px) 200px',
    maxWidth: '100%',
    margin: '0',
    caretColor: 'var(--accent)',
  },
  '.cm-line': {
    padding: '0',
    lineHeight: 'var(--line-content)',
  },
  '.cm-lineNumbers': {
    fontFamily: 'var(--editor-content-font-family, var(--font-content))',
    fontSize: 'var(--editor-content-font-size, var(--size-body))',
    lineHeight: 'var(--line-content)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    lineHeight: 'var(--line-content)',
    fontSize: 'inherit',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--text-primary) 3.5%, transparent)',
    borderRadius: '6px',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent) !important',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 48%, transparent)',
  },
})
