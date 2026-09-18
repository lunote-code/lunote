export type AnthropicSseParseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }

export function* parseAnthropicSseChunk(chunk: string): Generator<AnthropicSseParseEvent> {
  const lines = chunk.split('\n')
  let eventName = ''
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload) continue
    try {
      const json = JSON.parse(payload) as {
        type?: string
        delta?: { type?: string; text?: string }
      }
      const type = json.type ?? eventName
      if (type === 'message_stop' || type === 'content_block_stop') {
        yield { type: 'done' }
        continue
      }
      if (type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        const text = json.delta.text
        if (typeof text === 'string' && text.length > 0) {
          yield { type: 'delta', text }
        }
      }
    } catch {
      // Ignore malformed SSE lines.
    }
  }
}

export async function* parseAnthropicSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AnthropicSseParseEvent> {
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
        for (const event of parseAnthropicSseChunk(part)) {
          yield event
        }
      }
    }
    if (buffer.trim()) {
      for (const event of parseAnthropicSseChunk(buffer)) {
        yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}
