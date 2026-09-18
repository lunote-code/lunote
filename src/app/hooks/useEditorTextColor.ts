import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { countSelectionWords } from '../documentContentStats'
import { applySourceTextColor } from '../../editor/markdownInsertHelpers'
import { resolveFormatToolbarCommandActive } from '../../editor/editorFormatToolbarState'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { readBlockNativeTextareaSelection } from '../../editor/webviewPasteFocus'
import { isCodeBlockCmFocused } from '../../editor/codeBlock/cm/codeBlockCmFocus'
import type { EditorView } from '@codemirror/view'

export type EditorTextColorDeps = {
  mainPaneMode: 'visual' | 'source'
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: MutableRefObject<EditorView | null>
  /** Bumped from TipTap `selectionUpdate` (document `selectionchange` misses PM double-click). */
  visualSelectionTick?: number
}

function readSelectionText(
  mainPaneMode: 'visual' | 'source',
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>,
  editorViewRef: MutableRefObject<EditorView | null>,
): string {
  if (mainPaneMode === 'visual') {
    if (isCodeBlockCmFocused()) return ''
    const native = readBlockNativeTextareaSelection()
    if (native && native.text.length > 0) return native.text.trim()
    return visualEditorRef.current?.getSelectedText()?.trim() ?? ''
  }
  const v = editorViewRef.current
  if (!v) return ''
  const { from, to } = v.state.selection.main
  if (from === to) return ''
  return v.state.sliceDoc(from, to).trim()
}

function readHasTextSelection(
  mainPaneMode: 'visual' | 'source',
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>,
  editorViewRef: MutableRefObject<EditorView | null>,
): boolean {
  return readSelectionText(mainPaneMode, visualEditorRef, editorViewRef).length > 0
}

export function useEditorHasTextSelection(deps: EditorTextColorDeps): boolean {
  const { mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick = 0 } = deps
  const [hasTextSelection, setHasTextSelection] = useState(false)

  useEffect(() => {
    const sync = () => {
      setHasTextSelection(readHasTextSelection(mainPaneMode, visualEditorRef, editorViewRef))
    }
    sync()
    document.addEventListener('selectionchange', sync)
    document.addEventListener('focusin', sync)
    return () => {
      document.removeEventListener('selectionchange', sync)
      document.removeEventListener('focusin', sync)
    }
  }, [mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick])

  return hasTextSelection
}

export type EditorSelectionStats = {
  chars: number
  words: number
}

export function useEditorSelectionStats(deps: EditorTextColorDeps): EditorSelectionStats {
  const { mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick = 0 } = deps
  const [selectionStats, setSelectionStats] = useState<EditorSelectionStats>({ chars: 0, words: 0 })

  useEffect(() => {
    const sync = () => {
      const text = readSelectionText(mainPaneMode, visualEditorRef, editorViewRef)
      setSelectionStats({ chars: text.length, words: countSelectionWords(text) })
    }
    sync()
    document.addEventListener('selectionchange', sync)
    document.addEventListener('focusin', sync)
    return () => {
      document.removeEventListener('selectionchange', sync)
      document.removeEventListener('focusin', sync)
    }
  }, [mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick])

  return selectionStats
}

export function useEditorSelectionCharCount(deps: EditorTextColorDeps): number {
  return useEditorSelectionStats(deps).chars
}

export function useEditorFormatToolbarActive(deps: EditorTextColorDeps): (commandId: string) => boolean {
  const { mainPaneMode, visualEditorRef, visualSelectionTick = 0 } = deps

  return useMemo(() => {
    if (mainPaneMode !== 'visual') return () => false
    void visualSelectionTick
    const editor = visualEditorRef.current?.getEditor() ?? null
    return (commandId: string) => resolveFormatToolbarCommandActive(editor, commandId)
  }, [mainPaneMode, visualEditorRef, visualSelectionTick])
}

export function useEditorTextColor(deps: EditorTextColorDeps) {
  const { mainPaneMode, visualEditorRef, editorViewRef } = deps

  const applyEditorTextColor = useCallback(
    (color: string | null) => {
      if (mainPaneMode === 'visual') {
        visualEditorRef.current?.runCommand({ type: 'setTextColor', color })
        requestAnimationFrame(() => visualEditorRef.current?.focus())
        return
      }
      const v = editorViewRef.current
      if (!v) return
      if (!applySourceTextColor(v, color)) return
      requestAnimationFrame(() => editorViewRef.current?.focus())
    },
    [editorViewRef, mainPaneMode, visualEditorRef],
  )

  return { applyEditorTextColor }
}
