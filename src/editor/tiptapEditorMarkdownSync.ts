import type { MutableRefObject } from 'react'
import type { Editor } from '@tiptap/core'

import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../lib/tabNavigationDebug'
import { flushAllCodeBlockSessions } from './codeBlock/boundary/codeBlockSessionRegistry'
import { reconcileCodeBlockCmFocusAfterSerialize } from './codeBlock/cm/codeBlockCmPmFocusReconcile'
import { flushMermaidSourceForSerialize } from './mermaid/mermaidSourceBridge'
import { unescapeWikiLinksInMarkdown, normalizeWikiLinkBlockRefEscapesInMarkdown } from './knowledgeRuntime/wikiLinkParser'
import { logPasteScrollMarkdownSync } from './pasteScrollDebug'
import type { PendingMarkdownSyncResult } from './tiptapEditorTypes'

type TiptapEditorMarkdownSyncRuntimeArgs = {
  documentKeyRef: MutableRefObject<string>
  suppressMarkdownSyncRef?: MutableRefObject<boolean> | undefined
  composingRef: MutableRefObject<boolean>
  serializeTimerRef: MutableRefObject<number | null>
  serializeIdleCallbackRef: MutableRefObject<number | null>
  editorInstanceRef: MutableRefObject<Editor | null>
  lastExternalMarkdownRef: MutableRefObject<string>
  lastNormalizedExternalMarkdownRef: MutableRefObject<string>
  onMarkdownChangeRef: MutableRefObject<(markdown: string) => void>
  reportSerializeError: (error: unknown) => void
  debounceMs: number
}

export function normalizeSerializedMarkdownForSource(markdown: string): string {
  return normalizeWikiLinkBlockRefEscapesInMarkdown(unescapeWikiLinksInMarkdown(markdown))
}

function normalizeMarkdownWithEditor(value: string, editor: Editor): string {
  const doc = canonicalMarkdownSemantics.parse(value, editor.schema, { liftBlankLines: false })
  const serialized = canonicalMarkdownSemantics.trySerialize(doc, editor.schema)
  return serialized.ok ? serialized.markdown : value
}

function compileEditorMarkdownForSync(editor: Editor): PendingMarkdownSyncResult {
  flushAllCodeBlockSessions(editor)
  reconcileCodeBlockCmFocusAfterSerialize(editor)
  flushMermaidSourceForSerialize(editor)
  const serialized = canonicalMarkdownSemantics.trySerialize(editor.state.doc, editor.schema)
  if (serialized.ok === false) {
    return { ok: false, error: serialized.error }
  }
  return {
    ok: true,
    markdown: normalizeSerializedMarkdownForSource(serialized.markdown),
  }
}

export function createTiptapEditorMarkdownSyncRuntime(
  args: TiptapEditorMarkdownSyncRuntimeArgs,
) {
  const syncExternalMarkdownRefs = (value: string, editor: Editor | null) => {
    args.lastExternalMarkdownRef.current = value
    if (!editor) {
      args.lastNormalizedExternalMarkdownRef.current = value
      return
    }
    try {
      args.lastNormalizedExternalMarkdownRef.current = normalizeMarkdownWithEditor(value, editor)
    } catch {
      args.lastNormalizedExternalMarkdownRef.current = value
    }
  }

  const runMarkdownSerialize = (editor: Editor) => {
    if (args.suppressMarkdownSyncRef?.current) {
      logPasteScrollMarkdownSync({ phase: 'skip', pmView: editor.view, detail: { reason: 'suppressed' } })
      return
    }
    const serialized = compileEditorMarkdownForSync(editor)
    if (serialized.ok === false) {
      args.reportSerializeError(serialized.error)
      return
    }
    const next = serialized.markdown
    const previousExternal = args.lastExternalMarkdownRef.current
    const previousNormalized = args.lastNormalizedExternalMarkdownRef.current
    if (next === args.lastNormalizedExternalMarkdownRef.current) {
      if (isTabNavLogEnabled()) {
        logTabNav('editor-markdown-emit', {
          phase: 'skip-unchanged-normalized-markdown',
          current: snapshotDocumentBodyMeta('', next),
          previousExternal: snapshotDocumentBodyMeta('', previousExternal),
          previousNormalized: snapshotDocumentBodyMeta('', previousNormalized),
          pmDocSize: editor.state.doc.content.size,
        })
      }
      logPasteScrollMarkdownSync({
        phase: 'skip',
        pmView: editor.view,
        markdownLength: next.length,
        changed: false,
        detail: { reason: 'unchanged-normalized-markdown' },
      })
      return
    }
    args.lastExternalMarkdownRef.current = next
    args.lastNormalizedExternalMarkdownRef.current = next
    if (isTabNavLogEnabled()) {
      logTabNav('editor-markdown-emit', {
        phase: 'emit-change',
        current: snapshotDocumentBodyMeta('', next),
        previousExternal: snapshotDocumentBodyMeta('', previousExternal),
        previousNormalized: snapshotDocumentBodyMeta('', previousNormalized),
        pmDocSize: editor.state.doc.content.size,
      })
    }
    checkBlankContentSuspect('editor-markdown-serialize', args.documentKeyRef.current, next, {
      previousExternal: snapshotDocumentBodyMeta('', previousExternal),
      previousNormalized: snapshotDocumentBodyMeta('', previousNormalized),
      pmDocSize: editor.state.doc.content.size,
    })
    logPasteScrollMarkdownSync({
      phase: 'emit-change',
      pmView: editor.view,
      markdownLength: next.length,
      changed: true,
    })
    args.onMarkdownChangeRef.current(next)
  }

  const scheduleMarkdownSync = (editor: Editor, delay = args.debounceMs) => {
    if (args.suppressMarkdownSyncRef?.current) return
    if (args.composingRef.current || editor.view.composing) return
    logPasteScrollMarkdownSync({ phase: 'schedule', pmView: editor.view, delayMs: delay })
    if (
      args.serializeIdleCallbackRef.current != null &&
      typeof cancelIdleCallback === 'function'
    ) {
      cancelIdleCallback(args.serializeIdleCallbackRef.current)
      args.serializeIdleCallbackRef.current = null
    }
    if (args.serializeTimerRef.current != null) {
      window.clearTimeout(args.serializeTimerRef.current)
    }
    args.serializeTimerRef.current = window.setTimeout(() => {
      args.serializeTimerRef.current = null
      if (args.suppressMarkdownSyncRef?.current) return
      if (args.composingRef.current || editor.view.composing) return
      const run = () => {
        args.serializeIdleCallbackRef.current = null
        if (editor.isDestroyed) return
        if (args.editorInstanceRef.current !== editor) return
        logPasteScrollMarkdownSync({ phase: 'serialize', pmView: editor.view })
        runMarkdownSerialize(editor)
      }
      if (typeof requestIdleCallback === 'function') {
        args.serializeIdleCallbackRef.current = requestIdleCallback(run, { timeout: 500 })
      } else {
        run()
      }
    }, delay)
  }

  return {
    normalizeMarkdown: normalizeMarkdownWithEditor,
    syncExternalMarkdownRefs,
    compileEditorMarkdownForSync,
    runMarkdownSerialize,
    scheduleMarkdownSync,
  }
}
