import { defaultKeymap, deleteCharBackward, deleteCharForward, history, redo, selectAll, undo } from '@codemirror/commands'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'

import { createCmWebviewPasteExtension } from '../../cmWebviewPasteBridge'
import {
  runCodeBlockCmCopyKeymap,
  runCodeBlockCmCutKeymap,
  runCodeBlockCmPasteKeymap,
} from './codeBlockCmClipboard'
import {
  runCodeBlockCmBackspaceOnEmpty,
  runCodeBlockCmEnter,
  runCodeBlockCmShiftTab,
  runCodeBlockCmTab,
  shouldCodeBlockCmBoundaryDown,
  shouldCodeBlockCmBoundaryUp,
} from './codeBlockCmKeyboard'
import { createDeferredCmDocChangeExtension } from './codeBlockCmDefer'
import { codeBlockCmSyntaxHighlighting } from './codeBlockCmHighlightStyle'
import { resolveCodeMirrorLanguageDescription } from './codeBlockCmLanguage'

export const codeBlockCmLanguageCompartment = new Compartment()

export const codeBlockCmTheme = EditorView.theme({
  '&': {
    fontFamily: 'var(--font-code-block)',
    fontSize: 'var(--code-block-font-size)',
    lineHeight: 'var(--code-block-line-height)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    columnGap: 'var(--code-block-gutter-content-gap)',
  },
  '.cm-content': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color: 'var(--text-primary)',
    caretColor: 'var(--accent)',
    padding: '0 0 var(--code-block-pad-bottom) 0',
  },
  '.cm-line': {
    padding: '0 18px 0 0',
    lineHeight: 'inherit',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-gutter-fg, color-mix(in srgb, var(--text-muted) 70%, transparent))',
    borderRight: 'var(--hairline) solid color-mix(in srgb, var(--border-subtle) 48%, transparent)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  },
  '.cm-gutters.cm-gutters-before': {
    borderRightWidth: '1px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 12px',
    minWidth: '2.25rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 'inherit',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--text-primary) 3.5%, transparent)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent) !important',
  },
})

const filteredDefaultKeymap = defaultKeymap.filter((binding) => binding !== undo && binding !== redo)

export type CreateCodeBlockCmExtensionsArgs = {
  languageId: string | null | undefined
  tabSize?: number
  onDocChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: (relatedTarget: EventTarget | null) => void
  onBoundaryUp?: () => boolean
  onBoundaryDown?: () => boolean
  onDeleteEmptyBlock?: () => boolean
  onUndo?: () => boolean
  onRedo?: () => boolean
}

/** Base CM extensions for an embedded fenced code block (no language loaded yet). */
export function createCodeBlockCmBaseExtensions(args: CreateCodeBlockCmExtensionsArgs): Extension[] {
  const tabSize = args.tabSize ?? 4
  const exts: Extension[] = [
    history(),
    lineNumbers(),
    drawSelection(),
    highlightActiveLine(),
    createCmWebviewPasteExtension(),
    codeBlockCmSyntaxHighlighting,
    codeBlockCmTheme,
    EditorView.contentAttributes.of({ class: 'pm-code-block-cm-content', spellcheck: 'false' }),
    EditorState.tabSize.of(tabSize),
    EditorView.domEventHandlers({
      keydown(event) {
        const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
        const isRedo =
          (event.metaKey || event.ctrlKey) &&
          ((event.shiftKey && event.key.toLowerCase() === 'z') || event.key.toLowerCase() === 'y')
        if (isUndo) {
          event.preventDefault()
          return args.onUndo?.() ?? true
        }
        if (isRedo) {
          event.preventDefault()
          return args.onRedo?.() ?? true
        }
        return false
      },
      beforeinput(event) {
        const inputType = (event as InputEvent).inputType
        if (inputType === 'historyUndo') {
          event.preventDefault()
          return args.onUndo?.() ?? true
        }
        if (inputType === 'historyRedo') {
          event.preventDefault()
          return args.onRedo?.() ?? true
        }
        return false
      },
      focus() {
        args.onFocus?.()
      },
      focusout(event) {
        args.onBlur?.(event.relatedTarget)
      },
    }),
    keymap.of([
      { key: 'Enter', run: (view) => runCodeBlockCmEnter(view, tabSize) },
      { key: 'Tab', run: (view) => runCodeBlockCmTab(view, tabSize) },
      { key: 'Shift-Tab', run: (view) => runCodeBlockCmShiftTab(view, tabSize) },
      {
        key: 'Backspace',
        run: (view) => {
          const { from, to } = view.state.selection.main
          if (from !== to) return deleteCharBackward(view)
          if (from !== 0) return false
          return runCodeBlockCmBackspaceOnEmpty(view, args.onDeleteEmptyBlock)
        },
      },
      {
        key: 'Delete',
        run: (view) => {
          const { from, to } = view.state.selection.main
          if (from !== to) return deleteCharForward(view)
          return runCodeBlockCmBackspaceOnEmpty(view, args.onDeleteEmptyBlock)
        },
      },
      {
        key: 'ArrowUp',
        run: (view) => {
          if (!shouldCodeBlockCmBoundaryUp(view.state)) return false
          return args.onBoundaryUp?.() ?? false
        },
      },
      {
        key: 'ArrowDown',
        run: (view) => {
          if (!shouldCodeBlockCmBoundaryDown(view.state)) return false
          return args.onBoundaryDown?.() ?? false
        },
      },
      { key: 'Mod-z', run: () => args.onUndo?.() ?? false },
      { key: 'Mod-y', run: () => args.onRedo?.() ?? false },
      { key: 'Mod-Shift-z', run: () => args.onRedo?.() ?? false },
      { key: 'Mod-c', preventDefault: true, run: runCodeBlockCmCopyKeymap },
      { key: 'Mod-x', preventDefault: true, run: runCodeBlockCmCutKeymap },
      { key: 'Mod-v', preventDefault: true, run: runCodeBlockCmPasteKeymap },
      { key: 'Mod-a', run: selectAll },
      ...filteredDefaultKeymap,
    ]),
  ]

  if (args.onDocChange) {
    exts.push(...createDeferredCmDocChangeExtension(args.onDocChange))
  }

  exts.push(codeBlockCmLanguageCompartment.of([]))

  return exts
}

/** Async load syntax highlighting for the current language compartment. */
export async function loadCodeBlockCmLanguageExtension(
  languageId: string | null | undefined,
): Promise<Extension[]> {
  const desc = resolveCodeMirrorLanguageDescription(languageId)
  if (!desc) return []
  const support = await desc.load()
  return [support]
}
