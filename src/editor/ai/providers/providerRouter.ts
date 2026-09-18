import type { AiChatContext, AiProviderChatMessage } from '../aiChatTypes'
import type { AiSettings } from '../../../settings-runtime/aiSettings'
import { streamAnthropicChat } from './anthropicChat'
import { streamGoogleChat } from './googleChat'
import { openAiCompatibleHeadersForProvider, streamOpenAiCompatibleChat } from './openAiCompatibleChat'

export type ProviderChatOptions = {
  settings: AiSettings
  messages: AiProviderChatMessage[]
  context: AiChatContext
  signal?: AbortSignal
}

export async function* streamProviderChat(options: ProviderChatOptions): AsyncGenerator<string> {
  const provider = options.settings.provider
  switch (provider) {
    case 'anthropic':
      yield* streamAnthropicChat(options)
      return
    case 'google':
      yield* streamGoogleChat(options)
      return
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'local':
    case 'ollama':
    case 'lmstudio':
      yield* streamOpenAiCompatibleChat({
        ...options,
        extraHeaders: openAiCompatibleHeadersForProvider(provider),
      })
      return
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unsupported AI provider: ${String(_exhaustive)}`)
    }
  }
}
