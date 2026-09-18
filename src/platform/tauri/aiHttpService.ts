import { Channel, invoke, isTauri } from '@tauri-apps/api/core'

export type AiHttpRequestPayload = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export type AiHttpResponsePayload = {
  status: number
  body: string
}

export type AiHttpStreamEvent =
  | { kind: 'meta'; status: number }
  | { kind: 'chunk'; bytes: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function decodeBase64Chunk(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function normalizeHeaderRecord(headers: HeadersInit | undefined): Record<string, string> | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) {
    const record: Record<string, string> = {}
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}

function requestBodyString(body: BodyInit | null | undefined): string | undefined {
  if (body == null) return undefined
  if (typeof body === 'string') return body
  return undefined
}

function mapInvokeTransportError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'timeout' || message.toLowerCase().includes('timed out')) {
    throw Object.assign(new Error('timeout'), { code: 'timeout' as const })
  }
  throw error instanceof Error ? error : new Error(message)
}

export async function aiHttpRequestViaTauri(payload: AiHttpRequestPayload): Promise<AiHttpResponsePayload> {
  try {
    return await invoke<AiHttpResponsePayload>('ai_http_request', { payload })
  } catch (error) {
    mapInvokeTransportError(error)
  }
}

export async function aiHttpStreamViaTauri(
  payload: AiHttpRequestPayload,
  signal?: AbortSignal | null,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  let abortListener: (() => void) | null = null

  return new Promise<Response>((resolve, reject) => {
    let settled = false
    let status = 0
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      if (abortListener && signal) {
        signal.removeEventListener('abort', abortListener)
      }
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    const channel = new Channel<AiHttpStreamEvent>()
    channel.onmessage = (event) => {
      if (event.kind === 'meta') {
        status = event.status
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller
          },
          cancel() {
            void invoke('ai_http_stream_cancel', { requestId }).catch(() => undefined)
          },
        })
        settled = true
        resolve(new Response(body, { status }))
        return
      }
      if (!streamController) return
      if (event.kind === 'chunk') {
        streamController.enqueue(decodeBase64Chunk(event.bytes))
        return
      }
      if (event.kind === 'done') {
        streamController.close()
        if (abortListener && signal) {
          signal.removeEventListener('abort', abortListener)
        }
        return
      }
      if (event.kind === 'error') {
        streamController.error(new Error(event.message))
        if (abortListener && signal) {
          signal.removeEventListener('abort', abortListener)
        }
      }
    }

    if (signal) {
      abortListener = () => {
        void invoke('ai_http_stream_cancel', { requestId }).catch(() => undefined)
      }
      signal.addEventListener('abort', abortListener)
      if (signal.aborted) {
        abortListener()
      }
    }

    void invoke('ai_http_stream', { payload, requestId, onEvent: channel })
      .catch((error) => {
        if (streamController) {
          streamController.error(error instanceof Error ? error : new Error(String(error)))
          if (abortListener && signal) {
            signal.removeEventListener('abort', abortListener)
          }
          return
        }
        fail(error)
      })
  })
}

export function shouldUseTauriAiHttpTransport(): boolean {
  return isTauri()
}

export function buildAiHttpPayload(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): AiHttpRequestPayload {
  return {
    url,
    method: init.method ?? 'GET',
    headers: normalizeHeaderRecord(init.headers),
    body: requestBodyString(init.body ?? undefined),
    timeoutMs,
  }
}
