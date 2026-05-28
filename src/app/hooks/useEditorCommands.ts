import { useCallback, type MutableRefObject, type RefObject } from 'react'
import { findNext as cmFindNext, findPrevious as cmFindPrevious, openSearchPanel } from '@codemirror/search'
import { markdownToPlainHtmlFragment } from '../../markdownExport'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { pathsEqual } from '../../lib/workspacePathUtils'
import {
  bridgeDeleteSelection,
  bridgeOpenSearchPanel,
  bridgeRefocusActiveEditor,
  bridgeInsertImage,
} from '../../editor/editorMutationBridge'
import { imageAltFromFileName, pickLocalImageFiles } from '../../editor/lunaInsertImagePicker'
import { pasteFromNavigatorClipboard } from '../../editor/pasteFromNavigatorClipboard'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import type { EditorView } from '@codemirror/view'
import type { TranslateFn } from '../../i18n'
import { LARGE_DOC_THRESHOLD } from '../workspace/constants'

export type EditorCommandsDeps = {
  t: TranslateFn
  mainPaneMode: 'visual' | 'source'
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: RefObject<EditorView | null>
  kernelContentDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  pasteImageIntoVisualEditor: (file: File, mimeHint: string) => Promise<string | null>
  setStatus: (msg: string) => void
}

export function useEditorCommands(deps: EditorCommandsDeps) {
  const {
    t,
    mainPaneMode,
    mainPaneModeRef,
    activePathRef,
    contentRef,
    visualEditorRef,
    editorViewRef,
    kernelContentDebounceRef,
    pasteImageIntoVisualEditor,
    setStatus,
  } = deps

  const focusActiveEditor = useCallback(() => {
    if (mainPaneMode === 'visual') {
      visualEditorRef.current?.focus()
    } else {
      const cm = editorViewRef.current
      if (cm) {
        try {
          cm.focus()
        } catch {
          /* ignore */
        }
      }
    }
  }, [editorViewRef, mainPaneMode, visualEditorRef])

  const openFindPanel = useCallback(() => {
    bridgeOpenSearchPanel()
  }, [])

  const findNextInDocument = useCallback(() => {
    if (mainPaneMode === 'visual') {
      const ok = visualEditorRef.current?.moveSearch(1) ?? false
      if (!ok) setStatus(t('app.menu.findUnavailable'))
      return
    }
    const v = editorViewRef.current
    if (!v) return
    openSearchPanel(v)
    cmFindNext(v)
  }, [editorViewRef, mainPaneMode, setStatus, t, visualEditorRef])

  const findPreviousInDocument = useCallback(() => {
    if (mainPaneMode === 'visual') {
      const ok = visualEditorRef.current?.moveSearch(-1) ?? false
      if (!ok) setStatus(t('app.menu.findUnavailable'))
      return
    }
    const v = editorViewRef.current
    if (!v) return
    openSearchPanel(v)
    cmFindPrevious(v)
  }, [editorViewRef, mainPaneMode, setStatus, t, visualEditorRef])

  const copySelectionAs = useCallback(
    async (kind: 'plain' | 'markdown' | 'html') => {
      if (mainPaneMode === 'visual') {
        const text =
          kind === 'plain'
            ? (visualEditorRef.current?.getSelectedText() ?? '')
            : (visualEditorRef.current?.getSelectedMarkdown() ?? '')
        if (kind === 'html') {
          const frag = await markdownToPlainHtmlFragment(text)
          await navigator.clipboard.writeText(frag)
        } else {
          await navigator.clipboard.writeText(text)
        }
        return
      }
      const v = editorViewRef.current
      if (!v) return
      const { from, to } = v.state.selection.main
      const text = v.state.sliceDoc(from, to)
      if (kind === 'html') {
        const frag = await markdownToPlainHtmlFragment(text)
        await navigator.clipboard.writeText(frag)
      } else {
        await navigator.clipboard.writeText(text)
      }
    },
    [editorViewRef, mainPaneMode, visualEditorRef],
  )

  const cutSelectionToClipboard = useCallback(async () => {
    if (mainPaneMode === 'visual') {
      const text = visualEditorRef.current?.getSelectedText() ?? ''
      if (!text) return
      await navigator.clipboard.writeText(text)
      bridgeDeleteSelection()
      requestAnimationFrame(() => visualEditorRef.current?.focus())
    } else {
      const v = editorViewRef.current
      if (!v) return
      const { from, to } = v.state.selection.main
      if (from === to) return
      const text = v.state.sliceDoc(from, to)
      await navigator.clipboard.writeText(text)
      bridgeDeleteSelection()
      requestAnimationFrame(() => editorViewRef.current?.focus())
    }
    setStatus(t('app.status.cutDone'))
  }, [editorViewRef, mainPaneMode, setStatus, t, visualEditorRef])

  const pastePlainFromClipboard = useCallback(
    async (plainOnly = false) => {
      try {
        const ok = await pasteFromNavigatorClipboard({
          plainOnly,
          onPasteImage: plainOnly ? undefined : pasteImageIntoVisualEditor,
          visualEditorRef,
          sourceViewRef: editorViewRef,
          mainPaneMode: mainPaneModeRef.current,
        })
        if (!ok) setStatus(t('app.status.clipboardReadFailed'))
      } catch {
        setStatus(t('app.status.clipboardReadFailed'))
      }
    },
    [editorViewRef, mainPaneModeRef, pasteImageIntoVisualEditor, setStatus, t, visualEditorRef],
  )

  const insertImagesFromPicker = useCallback(async () => {
    const files = await pickLocalImageFiles({ title: t('app.dialog.pickImage') })
    if (!files.length) return
    bridgeRefocusActiveEditor()
    let inserted = 0
    for (const file of files) {
      const src = await pasteImageIntoVisualEditor(file, file.type)
      if (!src) continue
      bridgeInsertImage(src, imageAltFromFileName(file.name))
      inserted += 1
    }
    if (inserted > 0) {
      setStatus(t('app.status.imagesInserted', { count: inserted }))
    } else {
      setStatus(t('app.status.noImagesInserted'))
    }
  }, [pasteImageIntoVisualEditor, setStatus, t])

  const cancelPendingKernelContentDebounce = useCallback(() => {
    if (kernelContentDebounceRef.current != null) {
      clearTimeout(kernelContentDebounceRef.current)
      kernelContentDebounceRef.current = null
    }
  }, [kernelContentDebounceRef])

  const handleEditorContentChange = useCallback(
    (value: string) => {
      const pathAtChange = activePathRef.current || 'scratch'
      if (mainPaneMode === 'visual' && visualEditorRef.current) {
        const bound = visualEditorRef.current.getBoundDocumentKey()
        if (!pathsEqual(bound, pathAtChange)) return
      }
      contentRef.current = value
      if (pathAtChange !== 'scratch') setSourceModeIdentity(pathAtChange, value)
      cancelPendingKernelContentDebounce()
      const debounceMs = value.length >= LARGE_DOC_THRESHOLD ? 200 : 80
      const scheduledPath = pathAtChange
      const scheduledValue = value
      kernelContentDebounceRef.current = setTimeout(() => {
        kernelContentDebounceRef.current = null

        // Drop stale dispatches once tab/path changed; prevents path-content mismatch.
        const currentPath = activePathRef.current || 'scratch'
        if (!pathsEqual(currentPath, scheduledPath)) return

        if (mainPaneModeRef.current === 'visual' && visualEditorRef.current) {
          const bound = visualEditorRef.current.getBoundDocumentKey()
          if (!pathsEqual(bound, scheduledPath)) return
        }
        void dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path: scheduledPath,
          content: scheduledValue,
          source: 'editor',
        }).catch((error) => {
          console.error('[DOCUMENT KERNEL] content change failed', error)
        })
      }, debounceMs)
    },
    [
      activePathRef,
      contentRef,
      cancelPendingKernelContentDebounce,
      kernelContentDebounceRef,
      mainPaneMode,
      mainPaneModeRef,
      visualEditorRef,
    ],
  )

  return {
    focusActiveEditor,
    openFindPanel,
    findNextInDocument,
    findPreviousInDocument,
    copySelectionAs,
    cutSelectionToClipboard,
    pastePlainFromClipboard,
    insertImagesFromPicker,
    handleEditorContentChange,
    cancelPendingKernelContentDebounce,
  }
}
