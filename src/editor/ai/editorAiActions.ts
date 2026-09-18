import {
  bridgeRememberCurrentSelection,
  bridgeRememberInsertAnchor,
  bridgeRememberInsertAnchorAtSelectionEnd,
  bridgeSelectCurrentVisualBlock,
} from '../editorMutationBridge'
import {
  buildTranslateSelectionUserMessage,
  type AiQuickActionId,
} from './actions/aiQuickActions'
import { requestEditorAiCursorInsert, requestEditorAiDirectApply } from './editorAiCursorInsert'
import { requestEditorBlockAi } from './editorBlockAiRunner'
import type { BlockAiActionId, BlockAiTargetSnapshot } from './editorBlockAi'
import { buildListTransformSystemHint, type ListTransformTarget } from './listTransformPrompt'
import type { UiLocaleId } from '../../i18n/resolveLocale'

export type EditorAiSelectionToListActionId =
  | 'selection-to-bullet-list'
  | 'selection-to-ordered-list'
  | 'selection-to-task-list'

export type EditorAiSelectionActionId =
  | 'ask-selection'
  | 'edit-selection'
  | EditorAiSelectionToListActionId
  | 'translate-selection'
  | 'grammar-check'

const SELECTION_TO_LIST_TARGETS: Record<EditorAiSelectionToListActionId, ListTransformTarget> = {
  'selection-to-bullet-list': 'bullet',
  'selection-to-ordered-list': 'ordered',
  'selection-to-task-list': 'task',
}

const SELECTION_TO_LIST_MESSAGE_KEYS: Record<EditorAiSelectionToListActionId, string> = {
  'selection-to-bullet-list': 'editor.aiSelection.toList.bullet.message',
  'selection-to-ordered-list': 'editor.aiSelection.toList.ordered.message',
  'selection-to-task-list': 'editor.aiSelection.toList.task.message',
}

export function isEditorAiSelectionToListActionId(
  actionId: string | null | undefined,
): actionId is EditorAiSelectionToListActionId {
  return (
    actionId === 'selection-to-bullet-list' ||
    actionId === 'selection-to-ordered-list' ||
    actionId === 'selection-to-task-list'
  )
}

export type EditorAiSlashActionId = 'continue' | 'summarize' | 'edit-selection'

function requestCursorInsertAction(actionId: AiQuickActionId, t: (key: string) => string): void {
  bridgeRememberInsertAnchor()
  requestEditorAiCursorInsert(actionId, t)
}

const SELECTION_EXPLAIN_SYSTEM_HINT = [
  'Action output format: Output a concise, paste-ready Markdown explanation only—no preamble, postscript, or commentary outside the explanation.',
  'Explain the selected passage in plain language. Keep the explanation short and useful.',
  'Do not repeat the full selected text verbatim unless quoting a tiny snippet inline.',
].join('\n')

const SELECTION_GRAMMAR_REWRITE_SYSTEM_HINT = [
  'Action output format: Output the corrected text only—no JSON, preamble, postscript, bullet list, or commentary.',
  'Proofread the selected text for grammar, spelling, punctuation, and clarity.',
  'Preserve meaning, Markdown structure, links, inline code, and fenced code blocks.',
].join('\n')

/** Run a selection-scoped AI action from the editor toolbar, slash menu, or app menu. */
export function requestEditorAiSelectionAction(
  actionId: EditorAiSelectionActionId,
  t: (key: string) => string,
  effectiveLocale: UiLocaleId = 'en',
): void {
  switch (actionId) {
    case 'ask-selection':
      bridgeRememberInsertAnchorAtSelectionEnd()
      requestEditorAiDirectApply(
        {
          userMessage: t('ai.rail.command.askSelectionDraft'),
          taskMode: 'chat',
          systemHint: SELECTION_EXPLAIN_SYSTEM_HINT,
          autoApply: 'insert',
          requiresSelection: true,
          trackingKey: 'ask-selection',
          failedToastKey: 'ai.editor.directApply.failed',
          suppressWorkingToast: true,
          suppressDoneToast: true,
        },
        t,
      )
      return
    case 'edit-selection':
      bridgeRememberCurrentSelection()
      requestEditorAiDirectApply(
        {
          userMessage: t('ai.rail.quickActions.editSelection.message'),
          taskMode: 'rewrite',
          autoApply: 'replace',
          requiresSelection: true,
          trackingKey: 'edit-selection',
          failedToastKey: 'ai.editor.directApply.failed',
          suppressWorkingToast: true,
          suppressDoneToast: true,
        },
        t,
      )
      return
    case 'selection-to-bullet-list':
    case 'selection-to-ordered-list':
    case 'selection-to-task-list':
      bridgeRememberCurrentSelection()
      requestEditorAiDirectApply(
        {
          userMessage: t(SELECTION_TO_LIST_MESSAGE_KEYS[actionId]),
          taskMode: 'rewrite',
          systemHint: buildListTransformSystemHint('selection', SELECTION_TO_LIST_TARGETS[actionId]),
          autoApply: 'replace',
          requiresSelection: true,
          trackingKey: actionId,
          doneToastKey: 'ai.editor.directApply.doneToList',
          failedToastKey: 'ai.editor.directApply.failed',
        },
        t,
      )
      return
    case 'translate-selection':
      bridgeRememberCurrentSelection()
      requestEditorAiDirectApply(
        {
          userMessage: buildTranslateSelectionUserMessage(effectiveLocale),
          taskMode: 'translate',
          actionId: 'translate-selection',
          autoApply: 'replace',
          requiresSelection: true,
          trackingKey: 'translate-selection',
          failedToastKey: 'ai.editor.directApply.failed',
          suppressWorkingToast: true,
          suppressDoneToast: true,
        },
        t,
      )
      return
    case 'grammar-check':
      bridgeRememberCurrentSelection()
      requestEditorAiDirectApply(
        {
          userMessage: t('ai.rail.quickActions.grammarCheck.message'),
          taskMode: 'rewrite',
          systemHint: SELECTION_GRAMMAR_REWRITE_SYSTEM_HINT,
          autoApply: 'replace',
          requiresSelection: true,
          trackingKey: 'grammar-check',
          failedToastKey: 'ai.editor.directApply.failed',
          suppressWorkingToast: true,
          suppressDoneToast: true,
        },
        t,
      )
      return
    default:
      return
  }
}

/** Block-handle AI actions (lightweight single-block transforms). */
export function requestEditorBlockAiAction(
  actionId: BlockAiActionId,
  target: BlockAiTargetSnapshot,
  t: (key: string) => string,
): void {
  requestEditorBlockAi(actionId, target, t)
}

/** Slash-menu AI actions (trigger text already removed by slash handler). */
export function requestEditorAiSlashAction(
  actionId: EditorAiSlashActionId,
  t: (key: string) => string,
): void {
  switch (actionId) {
    case 'continue':
      requestCursorInsertAction('continue', t)
      return
    case 'summarize':
      requestCursorInsertAction('summarize', t)
      return
    case 'edit-selection':
      if (!bridgeSelectCurrentVisualBlock()) return
      requestEditorAiSelectionAction('edit-selection', t)
      return
    default:
      return
  }
}
