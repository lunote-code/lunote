import type { AiQuickActionId } from './aiQuickActions'

export type AiReplaceScope = 'selection' | 'document'

const DOCUMENT_REPLACE_ACTION_IDS = new Set<AiQuickActionId>(['auto-format'])

export function isDocumentReplaceAction(actionId?: AiQuickActionId | null): boolean {
  return actionId != null && DOCUMENT_REPLACE_ACTION_IDS.has(actionId)
}

export function resolveAiReplaceScope(
  actionId: AiQuickActionId | undefined | null,
  hasSelection: boolean,
): AiReplaceScope | null {
  if (hasSelection) return 'selection'
  if (isDocumentReplaceAction(actionId)) return 'document'
  return null
}

export function canApplyAiReplaceScope(
  scope: AiReplaceScope | null,
  hasSelection: boolean,
  hasDocumentBody: boolean,
): boolean {
  if (!scope) return false
  if (scope === 'selection') return hasSelection
  return hasDocumentBody
}
