import type { AiAutoApplyMode, AiQuickActionId } from './actions/aiQuickActions'
import type { AiGrammarIssue } from './grammar/grammarCheckTypes'
import type { TaskMode } from './prompts/types'

export type { TaskMode } from './prompts/types'
export { AI_CHAT_SYSTEM_PROMPT } from './prompts/system'

export type AiChatRole = 'user' | 'assistant' | 'system'

export type AiChatMessage = {
  id: string
  role: AiChatRole
  content: string
  createdAt: number
  /** Quick-action autoApply mode that produced this assistant reply, when applicable. */
  autoApply?: AiAutoApplyMode
  /** Quick action that produced this assistant reply, when applicable. */
  actionId?: AiQuickActionId
  /** Structured grammar issues when actionId is grammar-check. */
  grammarIssues?: AiGrammarIssue[]
  /** True when grammar-check output could not be parsed into issues. */
  grammarIssuesFailed?: boolean
}

export type AiChatErrorCode =
  | 'not_configured'
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'context_length'
  | 'aborted'
  | 'invalid_request'
  | 'empty_response'
  | 'unknown'

export type AiChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: AiChatErrorCode; detail?: string }

export type AiChatStatus = 'idle' | 'streaming' | 'error'

export type AiWorkspaceSnippet = {
  docKey: string
  title: string
  snippet: string
}

export type AiGraphNeighbor = {
  docKey: string
  title: string
  path: string
  excerpt?: string
}

export type AiChatContext = {
  docKey: string | null
  title: string | null
  excerpt: string | null
  selection: string | null
  workspaceSnippets?: AiWorkspaceSnippet[]
  mentionedNotes?: AiWorkspaceSnippet[]
  graphNeighbors?: AiGraphNeighbor[]
  /** 1 or 2 when graphNeighbors are included; used for system prompt labeling. */
  graphNeighborMaxHops?: 1 | 2
  /** Task-specific prompt layer; defaults to "chat". */
  taskMode?: TaskMode
  /** Quick action id for action-specific output specs in buildAiPrompt. */
  actionId?: AiQuickActionId
  systemHint?: string
  customSystemPrompt?: string | null
}

export type AiProviderChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export const AI_CHAT_EXCERPT_MAX_CHARS = 8_000

export const AI_CHAT_SELECTION_MAX_CHARS = 4_000

/** Max user+assistant turns sent to the provider (most recent). */
export const AI_CHAT_MAX_PROVIDER_MESSAGES = 20

export function createAiChatMessageId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
