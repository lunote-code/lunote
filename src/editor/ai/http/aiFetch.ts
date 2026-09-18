/** Shared fetch helpers for AI settings tests and chat streaming. */

/**
 * Desktop (Tauri) AI requests are proxied through Rust (`ai_http_*` commands) so
 * custom LAN base URLs (e.g. http://192.168.1.1:11434) work without widening CSP.
 * Browser/dev fallback keeps using `fetch`.
 */

import {
  aiHttpRequestViaTauri,
  aiHttpStreamViaTauri,
  buildAiHttpPayload,
  shouldUseTauriAiHttpTransport,
} from '../../../platform/tauri/aiHttpService'

export const DEFAULT_AI_FETCH_TIMEOUT_MS = 15_000

export const AI_CHAT_FETCH_TIMEOUT_MS = 120_000

export type AiHttpErrorKind = 'auth' | 'http' | 'rate_limit' | 'context_length'

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function joinUrl(base: string, path: string): string {
  return `${trimTrailingSlash(base)}${path.startsWith('/') ? path : `/${path}`}`
}

export function classifyHttpError(status: number): AiHttpErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 413) return 'context_length'
  return 'http'
}

async function fetchViaTauriProxy(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Response> {
  const payload = buildAiHttpPayload(url, init, timeoutMs)
  const method = (payload.method ?? 'GET').toUpperCase()
  try {
    if (method === 'GET' || method === 'HEAD') {
      const result = await aiHttpRequestViaTauri(payload)
      return new Response(result.body, { status: result.status })
    }
    return await aiHttpStreamViaTauri(payload, signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'timeout') {
      throw Object.assign(new Error('timeout'), { code: 'timeout' as const })
    }
    throw error
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_AI_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const parentSignal = init.signal
  const onParentAbort = () => controller.abort()
  parentSignal?.addEventListener('abort', onParentAbort)
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (shouldUseTauriAiHttpTransport()) {
      return await fetchViaTauriProxy(url, { ...init, signal: controller.signal }, timeoutMs, controller.signal)
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (parentSignal?.aborted) throw error
      throw Object.assign(new Error('timeout'), { code: 'timeout' as const })
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    parentSignal?.removeEventListener('abort', onParentAbort)
  }
}

export async function readResponseDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text()
    const trimmed = text.trim()
    if (!trimmed) return undefined
    try {
      const json = JSON.parse(trimmed) as {
        error?: { message?: string; code?: string }
        message?: string
      }
      const message = json.error?.message ?? json.message ?? trimmed.slice(0, 240)
      const code = json.error?.code?.toLowerCase() ?? ''
      if (code.includes('context') || message.toLowerCase().includes('context length')) {
        return message
      }
      return message
    } catch {
      return trimmed.slice(0, 240)
    }
  } catch {
    return undefined
  }
}

export function detailLooksLikeContextLength(detail: string | undefined): boolean {
  if (!detail) return false
  const lower = detail.toLowerCase()
  return lower.includes('context length') || lower.includes('maximum context') || lower.includes('token limit')
}

export function formatAiErrorDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined
  const trimmed = detail.trim()
  if (!trimmed) return undefined
  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: string }
      message?: string
    }
    const message = json.error?.message ?? json.message
    return message?.trim() || trimmed
  } catch {
    return trimmed
  }
}

export function detailLooksLikeInvalidModel(detail: string | undefined): boolean {
  if (!detail) return false
  const lower = formatAiErrorDetail(detail)?.toLowerCase() ?? detail.toLowerCase()
  return (
    lower.includes('model name format') ||
    lower.includes('model not found') ||
    lower.includes('is not found') ||
    lower.includes('not supported for generatecontent') ||
    lower.includes('no longer available') ||
    lower.includes('invalid model')
  )
}
