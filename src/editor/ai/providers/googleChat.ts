import type { AiChatContext, AiProviderChatMessage } from '../aiChatTypes'
import { AI_CHAT_FETCH_TIMEOUT_MS, fetchWithTimeout, joinUrl } from '../http/aiFetch'
import { parseGoogleStream } from '../streaming/parseGoogleStream'
import {
  AI_PROVIDER_DEFAULT_BASE_URL,
  resolveAiBaseUrlFromSettings,
  resolveAiModelFromSettings,
  type AiSettings,
} from '../../../settings-runtime/aiSettings'
import { buildAiSystemPrompt } from '../context/buildAiSystemPrompt'

export type GoogleChatOptions = {
  settings: AiSettings
  messages: AiProviderChatMessage[]
  context: AiChatContext
  signal?: AbortSignal
}


export async function* streamGoogleChat(options: GoogleChatOptions): AsyncGenerator<string> {
  const baseUrl = resolveAiBaseUrlFromSettings(options.settings) || AI_PROVIDER_DEFAULT_BASE_URL.google
  const model = resolveAiModelFromSettings(options.settings)
  const url = `${joinUrl(baseUrl, `/models/${encodeURIComponent(model)}:streamGenerateContent`)}?key=${encodeURIComponent(options.settings.apiKey ?? '')}&alt=sse`

  const contents = options.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildAiSystemPrompt(options.context) }] },
        contents,
      }),
    },
    AI_CHAT_FETCH_TIMEOUT_MS,
  )

  if (!response.ok || !response.body) {
    throw response
  }

  for await (const event of parseGoogleStream(response.body)) {
    if (event.type === 'delta') {
      yield event.text
      continue
    }
    if (event.type === 'error') {
      throw new Error(event.message)
    }
  }
}
