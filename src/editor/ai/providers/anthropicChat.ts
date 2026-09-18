import type { AiChatContext, AiProviderChatMessage } from '../aiChatTypes'
import { AI_CHAT_FETCH_TIMEOUT_MS, fetchWithTimeout, joinUrl } from '../http/aiFetch'
import { parseAnthropicSseStream } from '../streaming/parseAnthropicSse'
import {
  AI_PROVIDER_DEFAULT_BASE_URL,
  resolveAiBaseUrlFromSettings,
  resolveAiModelFromSettings,
  type AiSettings,
} from '../../../settings-runtime/aiSettings'
import { buildAiSystemPrompt } from '../context/buildAiSystemPrompt'

export type AnthropicChatOptions = {
  settings: AiSettings
  messages: AiProviderChatMessage[]
  context: AiChatContext
  signal?: AbortSignal
}


export async function* streamAnthropicChat(options: AnthropicChatOptions): AsyncGenerator<string> {
  const baseUrl = resolveAiBaseUrlFromSettings(options.settings) || AI_PROVIDER_DEFAULT_BASE_URL.anthropic
  const model = resolveAiModelFromSettings(options.settings)

  const response = await fetchWithTimeout(
    joinUrl(baseUrl, '/v1/messages'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.settings.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      signal: options.signal,
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system: buildAiSystemPrompt(options.context),
        messages: options.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    },
    AI_CHAT_FETCH_TIMEOUT_MS,
  )

  if (!response.ok || !response.body) {
    throw response
  }

  for await (const event of parseAnthropicSseStream(response.body)) {
    if (event.type === 'delta') yield event.text
  }
}
