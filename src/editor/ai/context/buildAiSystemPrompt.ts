import type { AiChatContext } from '../aiChatTypes'
import { buildAiPrompt } from '../prompts/prompt-builder'

/** @deprecated Prefer buildAiPrompt from prompts/prompt-builder. Kept for provider compatibility. */
export function buildAiSystemPrompt(context: AiChatContext): string {
  return buildAiPrompt(context)
}
