import type { RefObject } from 'react'

import { splitDocumentMarkdown } from '../../documentFrontmatter'
import { getBridgePaneMode, getBridgeSourceEditorView } from '../../editorMutationBridge'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { readAiEditorSelectionText } from '../context/readAiEditorSelection'
import type { AiReplaceScope } from './aiReplaceScope'

export type ReadAiReplaceBaselineInput = {
  scope: AiReplaceScope
  content: string
  activePath?: string | null
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

export function readLiveDocumentMarkdown(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
  contentFallback = '',
): string {
  if (getBridgePaneMode() === 'visual') {
    try {
      return visualEditorRef?.current?.flushPendingMarkdownSync(true, false) ?? contentFallback
    } catch {
      return contentFallback
    }
  }
  const view = getBridgeSourceEditorView()
  return view?.state.doc.toString() ?? contentFallback
}

export function readDocumentBodyMarkdown(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
  contentFallback = '',
  activePath?: string | null,
): string {
  const full = readLiveDocumentMarkdown(visualEditorRef, contentFallback)
  if (!activePath) return full.trim()
  return splitDocumentMarkdown(full).body.trim()
}

export function readAiReplaceBaseline(input: ReadAiReplaceBaselineInput): string {
  if (input.scope === 'selection') {
    return readAiEditorSelectionText(input.visualEditorRef)
  }
  return readDocumentBodyMarkdown(input.visualEditorRef, input.content, input.activePath)
}

export function hasReplaceableDocumentBody(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
  contentFallback = '',
  activePath?: string | null,
): boolean {
  return readDocumentBodyMarkdown(visualEditorRef, contentFallback, activePath).trim().length > 0
}
