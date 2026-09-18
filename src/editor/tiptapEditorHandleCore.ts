import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { MutableRefObject } from 'react'

import type { CompileEditorMarkdownOptions } from './tiptapEditorMarkdownSync'
import { focusTiptapProseMirrorSurface } from './tiptapEditorFocus'
import type { PmTocHeading } from './pmHeadingNav'
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
  revealSearchQuery: (editor: Editor, query: string, snippetHtml?: string) => boolean
  clearSearch: (editor: Editor) => void
  moveSearch: (editor: Editor, direction: 1 | -1) => void
  replaceSearchNext: (editor: Editor, replacement: string) => boolean
  compileEditorMarkdownForSync: (
    editor: Editor,
    options?: CompileEditorMarkdownOptions,
  ) => PendingMarkdownSyncResult
  lastExternalMarkdownRef: MutableRefObject<string>
  lastNormalizedExternalMarkdownRef: MutableRefObject<string>
  serializeTimerRef: MutableRefObject<number | null>
  serializeIdleCallbackRef: MutableRefObject<number | null>
  suppressMarkdownSyncRef?: MutableRefObject<boolean>
  onMarkdownChangeRef: MutableRefObject<(markdown: string) => void>
  normalizeMarkdown: (input: string, editor: Editor) => string
  toPendingMarkdownSyncError: (error: unknown) => Error
  composingRef: MutableRefObject<boolean>
  headingParseTimerRef: MutableRefObject<number | null>
  onOutlineHeadingsChangeRef: MutableRefObject<((headings: PmTocHeading[]) => void) | undefined>
  parseHeadingsFromPmDoc: (doc: Editor['state']['doc']) => PmTocHeading[]
  markUserEditIntent: () => void
}

export function createTiptapEditorHandleCore(
  args: TiptapEditorHandleCoreArgs,
): Pick<
  TiptapMarkdownEditorHandle,
  | 'getEditor'
  | 'getBoundDocumentKey'
  | 'focus'
  | 'openSearchPanel'
  | 'revealSearchQuery'
  | 'clearSearchHighlight'
  | 'isSearchPanelOpen'
  | 'moveSearch'
  | 'replaceSearchNext'
  | 'collapseSelectionForNavigation'
  | 'getMarkdown'
  | 'tryFlushPendingMarkdownSync'
  | 'flushPendingMarkdownSync'
  | 'normalizeMarkdownForCompare'
  | 'hasUserEditedSinceDocumentLoad'
  | 'waitForCompositionEnd'
  | 'syncOutlineHeadings'
  | 'markUserEdited'
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
    revealSearchQuery(query: string, snippetHtml?: string) {
      if (!args.editor) return false
      const ok = args.revealSearchQuery(args.editor, query, snippetHtml)
      if (!ok) return false
      args.bumpSearchVersion()
      return true
    },
    clearSearchHighlight() {
      if (!args.editor) return false
      args.setSearchMode('find')
      args.clearSearch(args.editor)
      args.bumpSearchVersion()
      return true
    },
    isSearchPanelOpen() {
      return args.searchOpenRef.current
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
    flushPendingMarkdownSync(
      force = false,
      emitChange = true,
      options?: { preserveCodeBlockEditing?: boolean },
    ) {
      if (!args.editor) return args.markdown
      clearPendingSerialize()
      if (!force && (args.suppressMarkdownSyncRef?.current || !args.hasUserEditedSinceDocumentLoadRef.current)) {
        return args.lastExternalMarkdownRef.current
      }
      const result = args.compileEditorMarkdownForSync(args.editor, options)
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
    syncOutlineHeadings() {
      if (!args.editor) return
      if (args.headingParseTimerRef.current != null) {
        window.clearTimeout(args.headingParseTimerRef.current)
        args.headingParseTimerRef.current = null
      }
      args.onOutlineHeadingsChangeRef.current?.(
        args.parseHeadingsFromPmDoc(args.editor.state.doc),
      )
    },
    markUserEdited() {
      args.markUserEditIntent()
    },
  }
}
