import type { RefObject } from 'react'
import { getBridgePaneMode, getBridgeSourceEditorView } from '../../editorMutationBridge'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { isCodeBlockCmFocused } from '../../codeBlock/cm/codeBlockCmFocus'

export function readAiEditorSelectionText(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
): string {
  const mode = getBridgePaneMode()
  if (mode === 'source') {
    const view = getBridgeSourceEditorView()
    if (!view) return ''
    const { from, to } = view.state.selection.main
    if (from === to) return ''
    return view.state.sliceDoc(from, to).trim()
  }
  if (isCodeBlockCmFocused()) return ''
  return visualEditorRef?.current?.getSelectedText()?.trim() ?? ''
}

export function hasAiEditorSelection(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
): boolean {
  return readAiEditorSelectionText(visualEditorRef).length > 0
}
