import type { AiChatContext, AiChatErrorCode, AiChatMessage, AiChatStreamEvent } from './aiChatTypes'
import { AI_CHAT_MAX_PROVIDER_MESSAGES } from './aiChatTypes'
import {
  classifyHttpError,
  detailLooksLikeContextLength,
  detailLooksLikeInvalidModel,
  readResponseDetail,
} from './http/aiFetch'
import { streamProviderChat } from './providers/providerRouter'
import {
  isAiConfiguredFromSettings,
  normalizeAiSettings,
  type AiSettings,
} from '../../settings-runtime/aiSettings'

export type StreamAiChatOptions = {
  settings: AiSettings
  messages: AiChatMessage[]
  context: AiChatContext
  signal?: AbortSignal
}

function toProviderMessages(messages: AiChatMessage[]) {
  const filtered = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }))
  if (filtered.length <= AI_CHAT_MAX_PROVIDER_MESSAGES) return filtered
  return filtered.slice(-AI_CHAT_MAX_PROVIDER_MESSAGES)
}

function mapHttpFailure(status: number, detail?: string): AiChatErrorCode {
  const kind = classifyHttpError(status)
  if (kind === 'auth') return 'auth'
  if (kind === 'rate_limit') return 'rate_limit'
  if (kind === 'context_length' || detailLooksLikeContextLength(detail)) return 'context_length'
  if (status === 400 || status === 404 || detailLooksLikeInvalidModel(detail)) return 'invalid_request'
  return 'unknown'
}

export async function* streamAiChat(options: StreamAiChatOptions): AsyncGenerator<AiChatStreamEvent> {
  const settings = normalizeAiSettings(options.settings)
  if (!isAiConfiguredFromSettings(settings)) {
    yield { type: 'error', code: 'not_configured' }
    return
  }

  try {
    for await (const text of streamProviderChat({
      settings,
      messages: toProviderMessages(options.messages),
      context: options.context,
      signal: options.signal,
    })) {
      if (options.signal?.aborted) {
        yield { type: 'error', code: 'aborted' }
        return
      }
      yield { type: 'delta', text }
    }
    yield { type: 'done' }
  } catch (error) {
    if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      yield { type: 'error', code: 'aborted' }
      return
    }
    if (error instanceof Response) {
      const detail = await readResponseDetail(error)
      yield { type: 'error', code: mapHttpFailure(error.status, detail), detail }
      return
    }
    const detail = error instanceof Error ? error.message : String(error)
    if ((error as Error & { code?: string }).code === 'timeout') {
      yield { type: 'error', code: 'network', detail }
      return
    }
    yield { type: 'error', code: 'network', detail }
  }
}
