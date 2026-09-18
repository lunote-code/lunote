export type OpenAiSseParseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }

export function* parseOpenAiSseChunk(chunk: string): Generator<OpenAiSseParseEvent> {
  const lines = chunk.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') {
      yield { type: 'done' }
      continue
    }
    try {
      const json = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string | null } }>
      }
      const text = json.choices?.[0]?.delta?.content
      if (typeof text === 'string' && text.length > 0) {
        yield { type: 'delta', text }
      }
    } catch {
      // Ignore malformed SSE lines.
    }
  }
}

export async function* parseOpenAiSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAiSseParseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        for (const event of parseOpenAiSseChunk(part)) {
          yield event
        }
      }
    }
    if (buffer.trim()) {
      for (const event of parseOpenAiSseChunk(buffer)) {
        yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}
