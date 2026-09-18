export type GoogleStreamParseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

function readGoogleErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; status?: unknown }
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message
    }
    if (typeof record.status === 'string' && record.status.length > 0) {
      return record.status
    }
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}

function* parseGoogleJsonPayload(payload: string): Generator<GoogleStreamParseEvent> {
  const trimmed = payload.trim()
  if (!trimmed || trimmed === '[') return
  const chunks = trimmed.startsWith('[')
    ? trimmed
        .slice(1)
        .replace(/\]\s*$/, '')
        .split(/\},\s*\{/)
        .map((part, index, all) => {
          if (all.length === 1) return part.replace(/^\[/, '').replace(/\]$/, '')
          if (index === 0) return `${part}}`
          if (index === all.length - 1) return `{${part}`
          return `{${part}}`
        })
    : [trimmed]
  for (const chunk of chunks) {
    const jsonText = chunk.trim()
    if (!jsonText) continue
    try {
      const json = JSON.parse(jsonText.startsWith('{') ? jsonText : `{${jsonText}}`) as {
        error?: unknown
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
        }>
      }
      if (json.error) {
        yield { type: 'error', message: readGoogleErrorMessage(json.error) }
        return
      }
      const parts = json.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          yield { type: 'delta', text: part.text }
        }
      }
    } catch {
      // Ignore malformed JSON chunks.
    }
  }
}

function* parseGoogleLine(line: string): Generator<GoogleStreamParseEvent> {
  const trimmed = line.trim()
  if (!trimmed) return

  let payload = trimmed
  if (trimmed.startsWith('data:')) {
    payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') {
      yield { type: 'done' }
      return
    }
  }

  for (const event of parseGoogleJsonPayload(payload)) {
    yield event
  }
}

export function* parseGoogleStreamChunk(chunk: string): Generator<GoogleStreamParseEvent> {
  const lines = chunk.includes('\n') ? chunk.split('\n') : [chunk]
  for (const line of lines) {
    for (const event of parseGoogleLine(line)) {
      yield event
    }
  }
}

export async function* parseGoogleStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<GoogleStreamParseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        for (const event of parseGoogleStreamChunk(line)) {
          yield event
        }
      }
    }
    if (buffer.trim()) {
      for (const event of parseGoogleStreamChunk(buffer)) {
        yield event
      }
    }
    yield { type: 'done' }
  } finally {
    reader.releaseLock()
  }
}
