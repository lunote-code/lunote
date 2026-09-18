import type { AiChatContext, AiProviderChatMessage } from '../aiChatTypes'
import { buildAiSystemPrompt } from '../context/buildAiSystemPrompt'
import {
  AI_CHAT_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  joinUrl,
} from '../http/aiFetch'
import { parseOpenAiSseStream } from '../streaming/parseOpenAiSse'
import type { AiSettings } from '../../../settings-runtime/aiSettings'
import { resolveAiBaseUrlFromSettings, resolveAiModelFromSettings } from '../../../settings-runtime/aiSettings'

export type OpenAiCompatibleChatOptions = {
  settings: AiSettings
  messages: AiProviderChatMessage[]
  context: AiChatContext
  signal?: AbortSignal
  extraHeaders?: Record<string, string>
}


export async function* streamOpenAiCompatibleChat(
  options: OpenAiCompatibleChatOptions,
): AsyncGenerator<string> {
  const baseUrl = resolveAiBaseUrlFromSettings(options.settings)
  const model = resolveAiModelFromSettings(options.settings)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.extraHeaders,
  }
  if (options.settings.apiKey) {
    headers.Authorization = `Bearer ${options.settings.apiKey}`
  }

  const response = await fetchWithTimeout(
    joinUrl(baseUrl, '/chat/completions'),
    {
      method: 'POST',
      headers,
      signal: options.signal,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: buildAiSystemPrompt(options.context) },
          ...options.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    },
    AI_CHAT_FETCH_TIMEOUT_MS,
  )

  if (!response.ok || !response.body) {
    throw response
  }

  for await (const event of parseOpenAiSseStream(response.body)) {
    if (event.type === 'delta') yield event.text
  }
}

export function openAiCompatibleHeadersForProvider(
  provider: AiSettings['provider'],
): Record<string, string> | undefined {
  if (provider === 'openrouter') {
    return {
      'HTTP-Referer': 'https://crossplatnote.local',
      'X-Title': 'CrossPlatNote',
    }
  }
  return undefined
}
