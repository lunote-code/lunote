import type { RefObject } from 'react'

import { joinMarkdownWithFrontmatter, splitDocumentMarkdown } from '../../documentFrontmatter'
import {
  bridgeInsertAssistantMarkdown,
  bridgeReplaceActiveDocumentMarkdown,
  bridgeRestoreLastNonEmptySelection,
} from '../../editorMutationBridge'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { hasAiEditorSelection } from '../context/readAiEditorSelection'
import type { AiQuickActionId } from './aiQuickActions'
import {
  canApplyAiReplaceScope,
  resolveAiReplaceScope,
} from './aiReplaceScope'
import { normalizeAssistantInsertMarkdown } from './normalizeAssistantInsertMarkdown'
import {
  hasReplaceableDocumentBody,
  readAiReplaceBaseline,
  readLiveDocumentMarkdown,
} from './readAiReplaceBaseline'

export type ApplyAssistantReplaceInput = {
  proposed: string
  actionId?: AiQuickActionId | null
  content: string
  activePath?: string | null
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
  onApplied?: () => void
}

function normalizeComparable(text: string): string {
  return text.replace(/\r\n/g, '\n').trim()
}

function applySelectionReplace(proposed: string): boolean {
  if (!bridgeRestoreLastNonEmptySelection()) return false
  return bridgeInsertAssistantMarkdown(proposed, 'replace')
}

function applyDocumentReplace(
  proposed: string,
  input: Pick<ApplyAssistantReplaceInput, 'content' | 'activePath' | 'visualEditorRef'>,
): boolean {
  const full = readLiveDocumentMarkdown(input.visualEditorRef, input.content)
  const { frontmatter, hadLeadingBlock } = splitDocumentMarkdown(full)
  const nextMarkdown = joinMarkdownWithFrontmatter(proposed, frontmatter, hadLeadingBlock)
  return bridgeReplaceActiveDocumentMarkdown(nextMarkdown)
}

export type AssistantReplaceResult = 'applied' | 'unchanged' | 'failed'

export function requestAssistantReplace(input: ApplyAssistantReplaceInput): AssistantReplaceResult {
  const proposed = normalizeAssistantInsertMarkdown(input.proposed)
  if (!proposed) return 'failed'

  const hasSelection = hasAiEditorSelection(input.visualEditorRef)
  const scope = resolveAiReplaceScope(input.actionId, hasSelection)
  const hasDocumentBody = hasReplaceableDocumentBody(
    input.visualEditorRef,
    input.content,
    input.activePath,
  )
  if (!canApplyAiReplaceScope(scope, hasSelection, hasDocumentBody) || !scope) {
    return 'failed'
  }

  const baseline = readAiReplaceBaseline({
    scope,
    content: input.content,
    activePath: input.activePath,
    visualEditorRef: input.visualEditorRef,
  })
  if (!baseline.trim() && scope === 'selection') return 'failed'

  if (normalizeComparable(baseline) === normalizeComparable(proposed)) {
    return 'unchanged'
  }

  const ok =
    scope === 'document' ? applyDocumentReplace(proposed, input) : applySelectionReplace(proposed)
  if (ok) {
    input.onApplied?.()
    return 'applied'
  }
  return 'failed'
}
