import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { MutableRefObject } from 'react'

import { focusTiptapProseMirrorSurface } from './tiptapEditorFocus'
import type {
  PendingMarkdownSyncResult,
  TiptapMarkdownEditorHandle,
} from './tiptapEditorTypes'

type SearchMode = 'find' | 'replace'

type TiptapEditorHandleCoreArgs = {
  editor: Editor | null
  editorInstanceRef: MutableRefObject<Editor | null>
  lastDocumentKeyRef: MutableRefObject<string>
  markdown: string
  hasUserEditedSinceDocumentLoadRef: MutableRefObject<boolean>
  setSearchMode: (mode: SearchMode) => void
  setSearchOpen: (open: boolean) => void
  bumpSearchVersion: () => void
  searchOpenRef: MutableRefObject<boolean>
  moveSearch: (editor: Editor, direction: 1 | -1) => void
  replaceSearchNext: (editor: Editor, replacement: string) => boolean
  compileEditorMarkdownForSync: (editor: Editor) => PendingMarkdownSyncResult
  lastExternalMarkdownRef: MutableRefObject<string>
  lastNormalizedExternalMarkdownRef: MutableRefObject<string>
  serializeTimerRef: MutableRefObject<number | null>
  serializeIdleCallbackRef: MutableRefObject<number | null>
  suppressMarkdownSyncRef?: MutableRefObject<boolean>
  onMarkdownChangeRef: MutableRefObject<(markdown: string) => void>
  normalizeMarkdown: (input: string, editor: Editor) => string
  toPendingMarkdownSyncError: (error: unknown) => Error
  composingRef: MutableRefObject<boolean>
}

export function createTiptapEditorHandleCore(
  args: TiptapEditorHandleCoreArgs,
): Pick<
  TiptapMarkdownEditorHandle,
  | 'getEditor'
  | 'getBoundDocumentKey'
  | 'focus'
  | 'openSearchPanel'
  | 'moveSearch'
  | 'replaceSearchNext'
  | 'collapseSelectionForNavigation'
  | 'getMarkdown'
  | 'tryFlushPendingMarkdownSync'
  | 'flushPendingMarkdownSync'
  | 'normalizeMarkdownForCompare'
  | 'hasUserEditedSinceDocumentLoad'
  | 'waitForCompositionEnd'
> {
  const clearPendingSerialize = () => {
    if (args.serializeTimerRef.current != null) {
      window.clearTimeout(args.serializeTimerRef.current)
      args.serializeTimerRef.current = null
    }
    if (
      args.serializeIdleCallbackRef.current != null &&
      typeof cancelIdleCallback === 'function'
    ) {
      cancelIdleCallback(args.serializeIdleCallbackRef.current)
      args.serializeIdleCallbackRef.current = null
    }
  }

  return {
    getEditor() {
      return args.editor ?? args.editorInstanceRef.current
    },
    getBoundDocumentKey() {
      return args.lastDocumentKeyRef.current || null
    },
    focus() {
      if (args.editor) focusTiptapProseMirrorSurface(args.editor)
    },
    openSearchPanel(options?: { replace?: boolean }) {
      if (!args.editor) return false
      args.setSearchMode(options?.replace ? 'replace' : 'find')
      args.setSearchOpen(true)
      args.bumpSearchVersion()
      return true
    },
    moveSearch(direction: 1 | -1) {
      if (!args.editor) return false
      if (!args.searchOpenRef.current) args.setSearchOpen(true)
      args.moveSearch(args.editor, direction)
      args.bumpSearchVersion()
      return true
    },
    replaceSearchNext(replacement: string) {
      if (!args.editor) return false
      if (!args.searchOpenRef.current) {
        args.setSearchMode('replace')
        args.setSearchOpen(true)
      }
      const ok = args.replaceSearchNext(args.editor, replacement)
      args.bumpSearchVersion()
      return ok
    },
    collapseSelectionForNavigation() {
      if (!args.editor) return
      const pos = args.editor.state.selection.from
      const tr = args.editor.state.tr.setSelection(TextSelection.create(args.editor.state.doc, pos))
      args.editor.view.dispatch(tr)
    },
    getMarkdown(force = false) {
      if (!args.editor) return args.markdown
      if (!force && !args.hasUserEditedSinceDocumentLoadRef.current) {
        return args.lastExternalMarkdownRef.current
      }
      const serialized = args.compileEditorMarkdownForSync(args.editor)
      return serialized.ok ? serialized.markdown : args.lastExternalMarkdownRef.current
    },
    tryFlushPendingMarkdownSync(force = false) {
      if (!args.editor) return { ok: true, markdown: args.markdown }
      clearPendingSerialize()
      if (!force && (args.suppressMarkdownSyncRef?.current || !args.hasUserEditedSinceDocumentLoadRef.current)) {
        return { ok: true, markdown: args.lastExternalMarkdownRef.current }
      }
      const serialized = args.compileEditorMarkdownForSync(args.editor)
      if (serialized.ok === false) {
        return serialized
      }
      const next = serialized.markdown
      if (next !== args.lastExternalMarkdownRef.current) {
        args.lastExternalMarkdownRef.current = next
        args.lastNormalizedExternalMarkdownRef.current = next
        args.onMarkdownChangeRef.current(next)
      }
      return { ok: true, markdown: next }
    },
    flushPendingMarkdownSync(force = false, emitChange = true) {
      if (!args.editor) return args.markdown
      clearPendingSerialize()
      if (!force && (args.suppressMarkdownSyncRef?.current || !args.hasUserEditedSinceDocumentLoadRef.current)) {
        return args.lastExternalMarkdownRef.current
      }
      const result = args.compileEditorMarkdownForSync(args.editor)
      if (result.ok === false) {
        throw args.toPendingMarkdownSyncError(result.error)
      }
      if (result.markdown !== args.lastExternalMarkdownRef.current) {
        args.lastExternalMarkdownRef.current = result.markdown
        args.lastNormalizedExternalMarkdownRef.current = result.markdown
        if (emitChange) {
          args.onMarkdownChangeRef.current(result.markdown)
        }
      }
      return result.markdown
    },
    normalizeMarkdownForCompare(input: string) {
      if (!args.editor) return null
      try {
        return args.normalizeMarkdown(input, args.editor)
      } catch {
        return null
      }
    },
    hasUserEditedSinceDocumentLoad() {
      return args.hasUserEditedSinceDocumentLoadRef.current
    },
    waitForCompositionEnd() {
      if (!args.editor || (!args.composingRef.current && !args.editor.view.composing)) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        const view = args.editor!.view
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          view.dom.removeEventListener('compositionend', finish)
          window.clearTimeout(timerId)
          resolve()
        }
        view.dom.addEventListener('compositionend', finish, { once: true })
        const timerId = window.setTimeout(finish, 3000)
      })
    },
  }
}
