import type { AppSettingsState } from '../settings/appSettingsTypes'
import { isBufferTabId } from '../documentRuntime/runtimePath'
import { vaultIdFromRoot } from '../editor/knowledgeRuntime/vaultRuntime'
import { normalizeGoogleModelId } from './googleModel'

export const AI_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openrouter',
  'local',
  'ollama',
  'lmstudio',
] as const
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

/** Providers that can work without a cloud API key when a base URL is available. */
export const AI_LOCAL_RUNTIME_PROVIDER_IDS = ['local', 'ollama', 'lmstudio'] as const satisfies readonly AiProviderId[]

const LEGACY_PROVIDER_ALIASES: Record<string, AiProviderId> = {
  'openai-compatible': 'local',
}

/** Doc key used when AI chat history is shared across the workspace. */
export const AI_GLOBAL_CONVERSATION_DOC_KEY = '__global__'

export type AiConversationScope = 'per-note' | 'global'

/** Normalized AI settings (always has provider/apiKey/baseUrl/model strings). */
export type AiSettings = {
  provider: AiProviderId
  apiKey: string
  baseUrl: string
  model: string
  includeWorkspaceSearch?: boolean
  includeGraphNeighbors?: boolean
  graphTwoHop?: boolean
  preferMentionContextOnly?: boolean
  systemPrompt?: string
  conversationScope?: AiConversationScope
}

export type AiSettingsInput = AppSettingsState['ai']

export const AI_PROVIDER_DEFAULT_BASE_URL: Record<AiProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  local: '',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
}

export const AI_PROVIDER_DEFAULT_MODEL: Record<AiProviderId, string> = {
  openai: 'gpt-5.4-mini',
  anthropic: 'claude-sonnet-5',
  google: 'gemini-3.5-flash',
  deepseek: 'deepseek-v4-flash',
  openrouter: 'openai/gpt-5.4-mini',
  local: '',
  ollama: 'qwen3.5:9b',
  lmstudio: '',
}

/** Common model ids per provider for preferences combobox presets. */
export const AI_PROVIDER_MODEL_PRESETS: Record<AiProviderId, readonly string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.5-pro', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5'],
  google: ['gemini-3.5-flash', 'gemini-3.5-pro', 'gemini-2.5-flash'],
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  openrouter: ['anthropic/claude-sonnet-5', 'openai/gpt-5.5', 'google/gemini-3.5-flash'],
  local: [],
  ollama: ['qwen3.5:9b', 'gemma4', 'llama4:scout', 'llama3.2'],
  lmstudio: [],
}

export const AI_PROVIDER_LABEL_KEYS: Record<AiProviderId, string> = {
  openai: 'settings.ai.provider.openai',
  anthropic: 'settings.ai.provider.anthropic',
  google: 'settings.ai.provider.google',
  deepseek: 'settings.ai.provider.deepseek',
  openrouter: 'settings.ai.provider.openrouter',
  local: 'settings.ai.provider.local',
  ollama: 'settings.ai.provider.ollama',
  lmstudio: 'settings.ai.provider.lmstudio',
}

export const AI_PROVIDER_DEFAULT = 'openai' satisfies AiProviderId

export function resolveAiModelPresetOptions(provider: unknown): readonly string[] {
  return AI_PROVIDER_MODEL_PRESETS[normalizeProvider(provider)]
}

function normalizeProvider(value: unknown): AiProviderId {
  if (typeof value === 'string') {
    const legacy = LEGACY_PROVIDER_ALIASES[value]
    if (legacy) return legacy
    if ((AI_PROVIDER_IDS as readonly string[]).includes(value)) {
      return value as AiProviderId
    }
  }
  return AI_PROVIDER_DEFAULT
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeAiSettings(ai: AiSettingsInput | undefined): AiSettings {
  const provider = normalizeProvider(ai?.provider)
  const result: AiSettings = {
    provider,
    apiKey: normalizeString(ai?.apiKey),
    baseUrl: normalizeString(ai?.baseUrl),
    model: normalizeString(ai?.model),
  }
  if (ai?.includeWorkspaceSearch === false) {
    result.includeWorkspaceSearch = false
  }
  if (ai?.includeGraphNeighbors === false) {
    result.includeGraphNeighbors = false
  }
  if (ai?.graphTwoHop === true) {
    result.graphTwoHop = true
  }
  if (ai?.preferMentionContextOnly === true) {
    result.preferMentionContextOnly = true
  }
  const systemPrompt = normalizeString(ai?.systemPrompt)
  if (systemPrompt) {
    result.systemPrompt = systemPrompt
  }
  const conversationScope = ai?.conversationScope
  if (conversationScope === 'global') {
    result.conversationScope = 'global'
  }
  return result
}

export function resolveAiSettings(snapshot: AppSettingsState): AiSettings {
  return normalizeAiSettings(snapshot.ai)
}

export function resolveAiProvider(snapshot: AppSettingsState): AiProviderId {
  return normalizeProvider(snapshot.ai?.provider)
}

export function resolveAiApiKey(snapshot: AppSettingsState): string {
  return normalizeString(snapshot.ai?.apiKey)
}

export function resolveAiBaseUrl(snapshot: AppSettingsState): string {
  return resolveAiBaseUrlFromSettings(resolveAiSettings(snapshot))
}

export function resolveAiBaseUrlFromSettings(settings: AiSettings): string {
  if (settings.baseUrl) return settings.baseUrl
  return AI_PROVIDER_DEFAULT_BASE_URL[normalizeProvider(settings.provider)]
}

export function resolveAiModel(snapshot: AppSettingsState): string {
  return resolveAiModelFromSettings(resolveAiSettings(snapshot))
}

export function resolveAiModelFromSettings(settings: AiSettings): string {
  const provider = normalizeProvider(settings.provider)
  const raw = settings.model || AI_PROVIDER_DEFAULT_MODEL[provider]
  if (provider === 'google') {
    return normalizeGoogleModelId(raw) || AI_PROVIDER_DEFAULT_MODEL.google
  }
  return raw
}

export function isLocalRuntimeAiProvider(provider: AiProviderId): boolean {
  return (AI_LOCAL_RUNTIME_PROVIDER_IDS as readonly string[]).includes(provider)
}

export function isAiConfigured(snapshot: AppSettingsState): boolean {
  return isAiConfiguredFromSettings(resolveAiSettings(snapshot))
}

export function isAiConfiguredFromSettings(settings: AiSettings): boolean {
  const provider = normalizeProvider(settings.provider)
  if (isLocalRuntimeAiProvider(provider)) {
    return resolveAiBaseUrlFromSettings(settings).length > 0
  }
  return (settings.apiKey ?? '').length > 0
}

export function resolveAiIncludeWorkspaceSearch(snapshot: AppSettingsState): boolean {
  return snapshot.ai?.includeWorkspaceSearch !== false
}

export function resolveAiIncludeGraphNeighbors(snapshot: AppSettingsState): boolean {
  return snapshot.ai?.includeGraphNeighbors !== false
}

export function resolveAiGraphTwoHop(snapshot: AppSettingsState): boolean {
  return snapshot.ai?.graphTwoHop === true
}

export function resolveAiPreferMentionContextOnly(snapshot: AppSettingsState): boolean {
  return snapshot.ai?.preferMentionContextOnly === true
}

export function resolveAiSystemPrompt(snapshot: AppSettingsState): string {
  return normalizeString(snapshot.ai?.systemPrompt)
}

export function resolveAiConversationScope(snapshot: AppSettingsState): AiConversationScope {
  return snapshot.ai?.conversationScope === 'global' ? 'global' : 'per-note'
}

export function resolveAiConversationDocKey(
  snapshot: AppSettingsState,
  activeDocKey: string | null,
  activePath?: string | null,
): string | null {
  if (resolveAiConversationScope(snapshot) === 'global') {
    return AI_GLOBAL_CONVERSATION_DOC_KEY
  }
  if (activePath && isBufferTabId(activePath)) {
    return activePath
  }
  return activeDocKey
}

/** Prefix conversation storage keys with vault id so different workspaces cannot collide. */
export function vaultScopeAiConversationDocKey(
  workspaceRoot: string,
  docKey: string | null,
): string | null {
  if (!docKey) return null
  const trimmedRoot = workspaceRoot.trim()
  if (!trimmedRoot) return docKey
  return `${vaultIdFromRoot(trimmedRoot)}::${docKey}`
}

export function readAiSettingsFromForm(values: {
  provider?: unknown
  apiKey?: unknown
  baseUrl?: unknown
  model?: unknown
}): AiSettings {
  return normalizeAiSettings({
    provider: typeof values.provider === 'string' ? normalizeProvider(values.provider) : undefined,
    apiKey: typeof values.apiKey === 'string' ? values.apiKey : undefined,
    baseUrl: typeof values.baseUrl === 'string' ? values.baseUrl : undefined,
    model: typeof values.model === 'string' ? values.model : undefined,
  })
}
