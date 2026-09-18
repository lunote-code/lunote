export type AiQuickActionId =
  | 'summarize'
  | 'summarize-selection'
  | 'continue'
  | 'translate-selection'
  | 'edit-selection'
  | 'auto-format'
  | 'grammar-check'
  | 'generate-flowchart'
  | 'related-to-note'
  | 'workspace-overview'

import { hasActionPrompt } from '../prompts/action-prompts'
import type { TaskMode } from '../prompts/types'
import type { UiLocaleId } from '../../../i18n/resolveLocale'

export type AiAutoApplyMode = 'replace' | 'insert' | 'frontmatter'

export type AiQuickActionDefinition = {
  id: AiQuickActionId
  labelKey: string
  hintKey?: string
  userMessageKey: string
  taskMode: TaskMode
  requiresSelection?: boolean
  requiresNoteContext?: boolean
  welcomeOnly?: boolean
  autoApply?: AiAutoApplyMode
}

export const AI_QUICK_ACTIONS: readonly AiQuickActionDefinition[] = [
  {
    id: 'summarize',
    labelKey: 'ai.rail.quickActions.summarize',
    hintKey: 'ai.rail.quickActions.hints.directInsert',
    userMessageKey: 'ai.rail.quickActions.summarize.message',
    taskMode: 'summarize',
    autoApply: 'insert',
  },
  {
    id: 'summarize-selection',
    labelKey: 'ai.rail.quickActions.summarizeSelection',
    hintKey: 'ai.rail.quickActions.hints.directInsert',
    userMessageKey: 'ai.rail.quickActions.summarizeSelection.message',
    taskMode: 'summarize',
    requiresSelection: true,
    autoApply: 'insert',
  },
  {
    id: 'continue',
    labelKey: 'ai.rail.quickActions.continue',
    hintKey: 'ai.rail.quickActions.hints.directInsert',
    userMessageKey: 'ai.rail.quickActions.continue.message',
    taskMode: 'write',
    autoApply: 'insert',
  },
  {
    id: 'translate-selection',
    labelKey: 'ai.rail.quickActions.translate',
    hintKey: 'ai.rail.quickActions.hints.chatAutoApply',
    userMessageKey: 'ai.rail.quickActions.translate.message',
    taskMode: 'translate',
    requiresSelection: true,
    autoApply: 'replace',
  },
  {
    id: 'edit-selection',
    labelKey: 'ai.rail.quickActions.editSelection',
    hintKey: 'ai.rail.quickActions.hints.chatAutoApply',
    userMessageKey: 'ai.rail.quickActions.editSelection.message',
    taskMode: 'rewrite',
    requiresSelection: true,
    autoApply: 'replace',
  },
  {
    id: 'auto-format',
    labelKey: 'ai.rail.quickActions.autoFormat',
    hintKey: 'ai.rail.quickActions.hints.chatAutoApply',
    userMessageKey: 'ai.rail.quickActions.autoFormat.message',
    taskMode: 'rewrite',
    autoApply: 'replace',
  },
  {
    id: 'grammar-check',
    labelKey: 'ai.rail.quickActions.grammarCheck',
    hintKey: 'ai.rail.quickActions.hints.chatReply',
    userMessageKey: 'ai.rail.quickActions.grammarCheck.message',
    taskMode: 'rewrite',
  },
  {
    id: 'generate-flowchart',
    labelKey: 'ai.rail.quickActions.generateFlowchart',
    hintKey: 'ai.rail.quickActions.hints.chatAutoApply',
    userMessageKey: 'ai.rail.quickActions.generateFlowchart.message',
    taskMode: 'write',
    autoApply: 'insert',
  },
  {
    id: 'related-to-note',
    labelKey: 'ai.rail.quickActions.relatedToNote',
    hintKey: 'ai.rail.quickActions.hints.chatReply',
    userMessageKey: 'ai.rail.quickActions.relatedToNote.message',
    taskMode: 'knowledge',
    requiresNoteContext: true,
    welcomeOnly: true,
  },
  {
    id: 'workspace-overview',
    labelKey: 'ai.rail.quickActions.workspaceOverview',
    hintKey: 'ai.rail.quickActions.hints.chatReply',
    userMessageKey: 'ai.rail.quickActions.workspaceOverview.message',
    taskMode: 'search',
    welcomeOnly: true,
  },
] as const

export function resolveAiQuickActionHintKey(actionId: AiQuickActionId): string | undefined {
  return AI_QUICK_ACTIONS.find((item) => item.id === actionId)?.hintKey
}

/** High-frequency footer actions shown inline; the rest go in the ··· overflow menu. */
export const AI_FOOTER_PRIMARY_ACTION_IDS: readonly AiQuickActionId[] = [
  'summarize',
  'continue',
  'translate-selection',
  'edit-selection',
] as const

/** Quick actions that insert at the editor cursor without polluting the chat thread. */
export const AI_CURSOR_INSERT_ACTION_IDS: readonly AiQuickActionId[] = [
  'summarize',
  'summarize-selection',
  'continue',
] as const

export function isCursorInsertQuickAction(actionId: AiQuickActionId): boolean {
  return (AI_CURSOR_INSERT_ACTION_IDS as readonly string[]).includes(actionId)
}

export type AiQuickActionPayload = {
  userMessage: string
  taskMode: TaskMode
  autoApply?: AiAutoApplyMode
  actionId?: AiQuickActionId
  /** Legacy or dynamic supplemental hint. */
  systemHint?: string
}

const TRANSLATE_SELECTION_TARGETS: Record<
  UiLocaleId,
  {
    primaryLanguage: string
    primaryLanguageSelfName: string
    reverseLanguage: string
  }
> = {
  en: {
    primaryLanguage: 'English',
    primaryLanguageSelfName: 'English',
    reverseLanguage: 'Simplified Chinese',
  },
  'zh-CN': {
    primaryLanguage: 'Simplified Chinese',
    primaryLanguageSelfName: '简体中文',
    reverseLanguage: 'English',
  },
  'zh-TW': {
    primaryLanguage: 'Traditional Chinese',
    primaryLanguageSelfName: '繁體中文',
    reverseLanguage: 'English',
  },
  ja: {
    primaryLanguage: 'Japanese',
    primaryLanguageSelfName: '日本語',
    reverseLanguage: 'English',
  },
  ko: {
    primaryLanguage: 'Korean',
    primaryLanguageSelfName: '한국어',
    reverseLanguage: 'English',
  },
  de: {
    primaryLanguage: 'German',
    primaryLanguageSelfName: 'Deutsch',
    reverseLanguage: 'English',
  },
  fr: {
    primaryLanguage: 'French',
    primaryLanguageSelfName: 'francais',
    reverseLanguage: 'English',
  },
  es: {
    primaryLanguage: 'Spanish',
    primaryLanguageSelfName: 'espanol',
    reverseLanguage: 'English',
  },
  it: {
    primaryLanguage: 'Italian',
    primaryLanguageSelfName: 'italiano',
    reverseLanguage: 'English',
  },
  pt: {
    primaryLanguage: 'Portuguese',
    primaryLanguageSelfName: 'portugues',
    reverseLanguage: 'English',
  },
  ru: {
    primaryLanguage: 'Russian',
    primaryLanguageSelfName: 'russkiy',
    reverseLanguage: 'English',
  },
}

export function buildTranslateSelectionUserMessage(effectiveLocale: UiLocaleId): string {
  const target = TRANSLATE_SELECTION_TARGETS[effectiveLocale] ?? TRANSLATE_SELECTION_TARGETS.en
  return [
    'Translate the selected text and preserve Markdown structure.',
    `Target the preferred output language for the current locale: ${target.primaryLanguage} (${target.primaryLanguageSelfName}).`,
    `If the source language is mixed, ambiguous, or unclear, default to ${target.primaryLanguage} (${target.primaryLanguageSelfName}).`,
    `If the selected text is already primarily in ${target.primaryLanguage} (${target.primaryLanguageSelfName}), translate it into ${target.reverseLanguage} instead.`,
    'Output the translation only.',
  ].join(' ')
}

export function buildAiQuickActionPayload(
  actionId: AiQuickActionId,
  t: (key: string) => string,
  effectiveLocale: UiLocaleId = 'en',
): AiQuickActionPayload | null {
  const action = AI_QUICK_ACTIONS.find((item) => item.id === actionId)
  if (!action) return null

  const payload: AiQuickActionPayload = {
    userMessage:
      actionId === 'translate-selection'
        ? buildTranslateSelectionUserMessage(effectiveLocale)
        : t(action.userMessageKey),
    taskMode: action.taskMode,
    autoApply: action.autoApply,
  }
  if (hasActionPrompt(actionId)) {
    payload.actionId = actionId
  }
  return payload
}

export function resolveAiQuickActionAutoApply(actionId: AiQuickActionId): AiAutoApplyMode | undefined {
  return AI_QUICK_ACTIONS.find((item) => item.id === actionId)?.autoApply
}
