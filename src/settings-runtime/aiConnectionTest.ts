import {
  AI_PROVIDER_DEFAULT_BASE_URL,
  isLocalRuntimeAiProvider,
  normalizeAiSettings,
  resolveAiBaseUrlFromSettings,
  resolveAiModelFromSettings,
  type AiSettings,
} from './aiSettings'
import {
  classifyHttpError,
  DEFAULT_AI_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  joinUrl,
  readResponseDetail,
} from '../editor/ai/http/aiFetch'

export type AiConnectionTestErrorCode =
  | 'missing_api_key'
  | 'missing_base_url'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'http'
  | 'unknown'

export type AiConnectionTestResult =
  | { ok: true; model: string }
  | { ok: false; code: AiConnectionTestErrorCode; detail?: string }

function validateSettings(settings: AiSettings): AiConnectionTestResult | null {
  const provider = settings.provider
  if (isLocalRuntimeAiProvider(provider)) {
    if (!resolveAiBaseUrlFromSettings(settings)) {
      return { ok: false, code: 'missing_base_url' }
    }
    return null
  }
  if (!settings.apiKey) {
    return { ok: false, code: 'missing_api_key' }
  }
  return null
}

function classifyConnectionTestError(status: number): AiConnectionTestErrorCode {
  const kind = classifyHttpError(status)
  if (kind === 'auth') return 'auth'
  return 'http'
}

async function testOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  extraHeaders?: Record<string, string>,
): Promise<AiConnectionTestResult> {
  const headers: Record<string, string> = { ...extraHeaders }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  try {
    const response = await fetchWithTimeout(
      joinUrl(baseUrl, '/models'),
      { headers },
      DEFAULT_AI_FETCH_TIMEOUT_MS,
    )
    if (response.ok) return { ok: true, model: '' }
    const detail = await readResponseDetail(response)
    return { ok: false, code: classifyConnectionTestError(response.status), detail }
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'timeout') {
      return { ok: false, code: 'timeout' }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, code: 'network', detail: message }
  }
}

async function testAnthropic(baseUrl: string, apiKey: string): Promise<AiConnectionTestResult> {
  try {
    const response = await fetchWithTimeout(
      joinUrl(baseUrl, '/v1/models'),
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
      DEFAULT_AI_FETCH_TIMEOUT_MS,
    )
    if (response.ok) return { ok: true, model: '' }
    const detail = await readResponseDetail(response)
    return { ok: false, code: classifyConnectionTestError(response.status), detail }
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'timeout') {
      return { ok: false, code: 'timeout' }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, code: 'network', detail: message }
  }
}

async function testGoogle(baseUrl: string, apiKey: string): Promise<AiConnectionTestResult> {
  try {
    const url = `${joinUrl(baseUrl, '/models')}?key=${encodeURIComponent(apiKey)}`
    const response = await fetchWithTimeout(url, { method: 'GET' }, DEFAULT_AI_FETCH_TIMEOUT_MS)
    if (response.ok) return { ok: true, model: '' }
    const detail = await readResponseDetail(response)
    return { ok: false, code: classifyConnectionTestError(response.status), detail }
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'timeout') {
      return { ok: false, code: 'timeout' }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, code: 'network', detail: message }
  }
}

async function testByProvider(settings: AiSettings): Promise<AiConnectionTestResult> {
  const provider = settings.provider
  const apiKey = settings.apiKey
  const baseUrl = resolveAiBaseUrlFromSettings(settings)

  switch (provider) {
    case 'anthropic':
      return testAnthropic(baseUrl || AI_PROVIDER_DEFAULT_BASE_URL.anthropic, apiKey)
    case 'google':
      return testGoogle(baseUrl || AI_PROVIDER_DEFAULT_BASE_URL.google, apiKey)
    case 'openrouter':
      return testOpenAiCompatible(baseUrl || AI_PROVIDER_DEFAULT_BASE_URL.openrouter, apiKey, {
        'HTTP-Referer': 'https://crossplatnote.local',
        'X-Title': 'CrossPlatNote',
      })
    case 'openai':
    case 'deepseek':
    case 'local':
    case 'ollama':
    case 'lmstudio':
      return testOpenAiCompatible(baseUrl, apiKey)
    default: {
      const _exhaustive: never = provider
      return { ok: false, code: 'unknown', detail: String(_exhaustive) }
    }
  }
}

export async function testAiConnection(input: AiSettings): Promise<AiConnectionTestResult> {
  const settings = normalizeAiSettings(input)
  const validationError = validateSettings(settings)
  if (validationError) return validationError

  const result = await testByProvider(settings)
  if (result.ok) {
    return { ok: true, model: resolveAiModelFromSettings(settings) }
  }
  return result
}
