import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { applySourceTextColor } from '../../editor/markdownInsertHelpers'
import { resolveFormatToolbarCommandActive } from '../../editor/editorFormatToolbarState'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { readBlockNativeTextareaSelection } from '../../editor/webviewPasteFocus'
import type { EditorView } from '@codemirror/view'

export type EditorTextColorDeps = {
  mainPaneMode: 'visual' | 'source'
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: MutableRefObject<EditorView | null>
  /** Bumped from TipTap `selectionUpdate` (document `selectionchange` misses PM double-click). */
  visualSelectionTick?: number
}

function readHasTextSelection(
  mainPaneMode: 'visual' | 'source',
  visualEditorRef: MutableRefObject<TiptapMarkdownEditorHandle | null>,
  editorViewRef: MutableRefObject<EditorView | null>,
): boolean {
  if (mainPaneMode === 'visual') {
    const native = readBlockNativeTextareaSelection()
    if (native && native.text.length > 0) return true
    return (visualEditorRef.current?.getSelectedText() ?? '').length > 0
  }
  const v = editorViewRef.current
  if (!v) return false
  const { from, to } = v.state.selection.main
  return from !== to
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
    return () => document.removeEventListener('selectionchange', sync)
  }, [mainPaneMode, visualEditorRef, editorViewRef, visualSelectionTick])

  return hasTextSelection
}

export function useEditorFormatToolbarActive(deps: EditorTextColorDeps): (commandId: string) => boolean {
  const { mainPaneMode, visualEditorRef, visualSelectionTick = 0 } = deps

  return useMemo(() => {
    if (mainPaneMode !== 'visual') return () => false
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
