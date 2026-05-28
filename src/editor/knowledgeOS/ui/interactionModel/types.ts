import type { DocKey, SearchHit, WikiLinkTarget } from '../../../knowledgeRuntime/types'

export type InteractionIntentType =
  | 'navigate'
  | 'hover'
  | 'hover_end'
  | 'search'
  | 'focus'
  | 'selection'
  | 'workspace_restore'

export type InteractionIntentSource =
  | 'wiki'
  | 'graph'
  | 'search'
  | 'tag'
  | 'editor'
  | 'backlink'
  | 'cmdk'
  | 'command'

export type InteractionIntentModifiers = {
  preserveSelection?: boolean
  suppressHover?: boolean
}

export type InteractionIntent = {
  type: InteractionIntentType
  source: InteractionIntentSource
  target?: WikiLinkTarget
  docKey?: DocKey
  absolutePath?: string
  searchHit?: SearchHit
  pointer?: { x: number; y: number }
  modifiers?: InteractionIntentModifiers
}

export type InteractionStepKind =
  | 'cancelHover'
  | 'clearSelection'
  | 'closeOverlay'
  | 'navigate'
  | 'scheduleHover'
  | 'openSearchModal'
  | 'updateSnapshot'
  | 'focusEditor'
  | 'emitGraphUpdate'
  | 'emitBacklinkUpdate'
  | 'emitSearchUpdate'

export type InteractionStep = {
  kind: InteractionStepKind
  intent: InteractionIntent
}

export type InteractionPlan = {
  intents: InteractionIntent[]
  steps: InteractionStep[]
}

export type InteractionEffectResult = {
  ok: boolean
  aborted?: boolean
}

export type InteractionExecutionReport = {
  plan: InteractionPlan
  results: InteractionEffectResult[]
  traceId?: string
}
