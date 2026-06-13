import { useCallback, type MutableRefObject, type RefObject } from 'react'
import { findNext as cmFindNext, findPrevious as cmFindPrevious, openSearchPanel } from '@codemirror/search'
import { markdownToPlainHtmlFragment } from '../../markdownExport'
import { attachDocumentFrontmatter, syncDocumentFrontmatterFromMarkdown } from '../../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { dispatchDocumentCommand, getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../../lib/tabNavigationDebug'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { setTabBody } from '../document/tabBodiesStore'
import {
  bridgeDeleteSelection,
  bridgeOpenSearchPanel,
  bridgeRefocusActiveEditor,
  bridgeInsertImage,
} from '../../editor/editorMutationBridge'
import { imageAltFromFileName, pickLocalImageFiles } from '../../editor/lunaInsertImagePicker'
import { pasteFromNavigatorClipboard } from '../../editor/pasteFromNavigatorClipboard'
import {
  codeBlockCmCutSelection,
  codeBlockCmSelectedText,
} from '../../editor/codeBlock/cm/codeBlockContextMenuActions'
import {
  getFocusedCodeBlockCmView,
  isCodeBlockCmFocused,
} from '../../editor/codeBlock/cm/codeBlockCmFocus'
import {
  cutNativeTextInputSelection,
  readBlockNativeTextareaSelection,
  readNativeTextInputSelection,
} from '../../editor/webviewPasteFocus'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import type { EditorView } from '@codemirror/view'
import type { TranslateFn } from '../../i18n'
import { isBufferTabId, LARGE_DOC_THRESHOLD } from '../workspace/constants'

export type EditorCommandsDeps = {
  t: TranslateFn
  mainPaneMode: 'visual' | 'source'
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  documentNavigationInProgressRef: MutableRefObject<boolean>
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
    documentNavigationInProgressRef,
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
      const dialogSelection = readNativeTextInputSelection()
      if (dialogSelection) {
        const text =
          kind === 'markdown' || kind === 'html'
            ? dialogSelection.element.value
            : dialogSelection.text
        if (kind === 'html') {
          const frag = await markdownToPlainHtmlFragment(text)
          await navigator.clipboard.writeText(frag)
        } else {
          await navigator.clipboard.writeText(text)
        }
        return
      }
      const nativeSelection = readBlockNativeTextareaSelection()
      if (nativeSelection) {
        const text = kind === 'markdown' ? nativeSelection.textarea.value : nativeSelection.text
        if (kind === 'html') {
          const frag = await markdownToPlainHtmlFragment(text)
          await navigator.clipboard.writeText(frag)
        } else {
          await navigator.clipboard.writeText(text)
        }
        return
      }
      if (mainPaneMode === 'visual' && isCodeBlockCmFocused()) {
        const cm = getFocusedCodeBlockCmView()
        if (cm) {
          const text = codeBlockCmSelectedText(cm)
          if (!text) return
          if (kind === 'html') {
            const frag = await markdownToPlainHtmlFragment(text)
            await navigator.clipboard.writeText(frag)
          } else {
            await navigator.clipboard.writeText(text)
          }
          return
        }
      }
      if (mainPaneMode === 'visual') {
        let text =
          kind === 'plain'
            ? (visualEditorRef.current?.getSelectedText() ?? '')
            : (visualEditorRef.current?.getSelectedMarkdown() ?? '')
        if (kind === 'plain' && !text.trim()) {
          text = visualEditorRef.current?.getSelectedMarkdown() ?? ''
        }
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
    if (await cutNativeTextInputSelection()) {
      setStatus(t('app.status.cutDone'))
      return
    }
    const nativeSelection = readBlockNativeTextareaSelection()
    if (nativeSelection) {
      if (!nativeSelection.text) return
      if (typeof document.execCommand === 'function' && document.execCommand('cut')) {
        setStatus(t('app.status.cutDone'))
        return
      }
      const { textarea, text } = nativeSelection
      await navigator.clipboard.writeText(text)
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      textarea.setRangeText('', start, end, 'end')
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteByCut' }))
      textarea.focus()
      setStatus(t('app.status.cutDone'))
      return
    }
    if (mainPaneMode === 'visual' && isCodeBlockCmFocused()) {
      const cm = getFocusedCodeBlockCmView()
      if (cm) {
        await codeBlockCmCutSelection(cm)
        return
      }
    }
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

  const shouldNormalizeEditorValueAgainstSaved = useCallback(
    (path: string, value: string): boolean => {
      if (mainPaneModeRef.current !== 'visual') return false
      const visual = visualEditorRef.current
      if (!visual) return false
      if (!pathsEqual(visual.getBoundDocumentKey(), path)) return false
      const saved = getDocumentSavedContent(path)
      if (saved == null) return false
      const normalizedValue = visual.normalizeMarkdownForCompare(value)
      const normalizedSaved = visual.normalizeMarkdownForCompare(saved)
      return normalizedValue != null && normalizedSaved != null && normalizedValue === normalizedSaved
    },
    [mainPaneModeRef, visualEditorRef],
  )

  const isSuspiciousNavigationShrink = useCallback(
    (path: string, previousValue: string, nextValue: string) => {
      if (!documentNavigationInProgressRef.current) return false
      if (!path || path === 'scratch' || isBufferTabId(path)) return false
      if (nextValue.length > 2 || nextValue.trim().length > 0) return false
      return previousValue.trim().length > 32
    },
    [documentNavigationInProgressRef],
  )

  const handleEditorContentChange = useCallback(
    (value: string) => {
      const pathAtChange = activePathRef.current || 'scratch'
      if (mainPaneMode === 'visual' && visualEditorRef.current) {
        const bound = visualEditorRef.current.getBoundDocumentKey()
        if (!pathsEqual(bound, pathAtChange)) {
          if (isTabNavLogEnabled()) {
            logTabNav('editor-content-change-skipped', {
              reason: 'visual-editor-bound-mismatch',
              pathAtChange,
              boundDocumentKey: bound,
              next: snapshotDocumentBodyMeta(pathAtChange, value),
            })
          }
          return
        }
      }
      const previousValue = contentRef.current
      if (isSuspiciousNavigationShrink(pathAtChange, previousValue, value)) {
        logTabNav('editor-content-change-skipped', {
          reason: 'navigation-suspicious-shrink',
          path: pathAtChange,
          mode: mainPaneMode,
          navigationInProgress: documentNavigationInProgressRef.current,
          previous: snapshotDocumentBodyMeta(pathAtChange, previousValue),
          next: snapshotDocumentBodyMeta(pathAtChange, value),
        })
        checkBlankContentSuspect('editor-content-change-guard', pathAtChange, value, {
          mode: mainPaneMode,
          navigationInProgress: documentNavigationInProgressRef.current,
          previous: snapshotDocumentBodyMeta(pathAtChange, previousValue),
        })
        return
      }
      if (isTabNavLogEnabled()) {
        logTabNav('editor-content-change', {
          path: pathAtChange,
          mode: mainPaneMode,
          previous: snapshotDocumentBodyMeta(pathAtChange, previousValue),
          next: snapshotDocumentBodyMeta(pathAtChange, value),
        })
      }
      checkBlankContentSuspect('editor-content-change', pathAtChange, value, {
        mode: mainPaneMode,
        previous: snapshotDocumentBodyMeta(pathAtChange, previousValue),
      })
      contentRef.current = value
      if (pathAtChange !== 'scratch') {
        setTabBody(pathAtChange, value)
        if (mainPaneMode === 'source') {
          syncDocumentFrontmatterFromMarkdown(pathAtChange, value)
          setSourceModeIdentity(pathAtChange, value)
        } else {
          setSourceModeIdentity(pathAtChange, attachDocumentFrontmatter(pathAtChange, value))
        }
      }
      cancelPendingKernelContentDebounce()
      const debounceMs = value.length >= LARGE_DOC_THRESHOLD ? 200 : 80
      const scheduledPath = pathAtChange
      const scheduledValue = value
      kernelContentDebounceRef.current = setTimeout(() => {
        kernelContentDebounceRef.current = null

        // Drop stale dispatches once tab/path changed; prevents path-content mismatch.
        const currentPath = activePathRef.current || 'scratch'
        if (!pathsEqual(currentPath, scheduledPath)) {
          if (isTabNavLogEnabled()) {
            logTabNav('editor-content-change-skipped', {
              reason: 'scheduled-path-stale',
              scheduledPath,
              currentPath,
              scheduled: snapshotDocumentBodyMeta(scheduledPath, scheduledValue),
            })
          }
          return
        }

        if (mainPaneModeRef.current === 'visual' && visualEditorRef.current) {
          const bound = visualEditorRef.current.getBoundDocumentKey()
          if (!pathsEqual(bound, scheduledPath)) {
            if (isTabNavLogEnabled()) {
              logTabNav('editor-content-change-skipped', {
                reason: 'scheduled-visual-bound-mismatch',
                scheduledPath,
                currentPath,
                boundDocumentKey: bound,
                scheduled: snapshotDocumentBodyMeta(scheduledPath, scheduledValue),
              })
            }
            return
          }
        }
        const shouldNormalize = shouldNormalizeEditorValueAgainstSaved(scheduledPath, scheduledValue)
        if (import.meta.env.DEV) {
          console.debug('[editor-dirty-probe]', {
            path: scheduledPath,
            source: shouldNormalize ? 'normalize-on-editor-sync' : 'editor',
            debounceMs,
            shouldNormalize,
            content: snapshotDocumentBodyMeta(scheduledPath, scheduledValue),
            saved: snapshotDocumentBodyMeta(scheduledPath, getDocumentSavedContent(scheduledPath)),
          })
        }
        if (isTabNavLogEnabled()) {
          logTabNav('editor-kernel-dispatch', {
            path: scheduledPath,
            source: shouldNormalize ? 'normalize-on-editor-sync' : 'editor',
            debounceMs,
            content: snapshotDocumentBodyMeta(scheduledPath, scheduledValue),
            saved: snapshotDocumentBodyMeta(scheduledPath, getDocumentSavedContent(scheduledPath)),
            shouldNormalize,
          })
        }
        checkBlankContentSuspect('editor-kernel-dispatch', scheduledPath, scheduledValue, {
          source: shouldNormalize ? 'normalize-on-editor-sync' : 'editor',
          debounceMs,
          saved: snapshotDocumentBodyMeta(scheduledPath, getDocumentSavedContent(scheduledPath)),
          shouldNormalize,
        })
        void dispatchDocumentCommand({
          type: shouldNormalize ? 'NORMALIZE_DOCUMENT_CONTENT' : 'DOCUMENT_CONTENT_CHANGED',
          path: scheduledPath,
          content: scheduledValue,
          source: shouldNormalize ? 'normalize-on-editor-sync' : 'editor',
        }).catch((error) => {
          console.error('[DOCUMENT KERNEL] content change failed', error)
        })
      }, debounceMs)
    },
    [
      activePathRef,
      contentRef,
      cancelPendingKernelContentDebounce,
      documentNavigationInProgressRef,
      isSuspiciousNavigationShrink,
      kernelContentDebounceRef,
      mainPaneMode,
      mainPaneModeRef,
      shouldNormalizeEditorValueAgainstSaved,
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
