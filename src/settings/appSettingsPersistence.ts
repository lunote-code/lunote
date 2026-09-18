import { isTauri } from '@tauri-apps/api/core'
import type { AppSettingsState } from './appSettingsTypes'
import { DEFAULT_APP_SETTINGS } from './appSettingsTypes'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import { normalizeEditorFontSize } from '../settings-runtime/editorTypography'
import { normalizeEditorColumnWidth } from '../settings-runtime/editorColumnWidth'
import {
  clearLegacyFormatToolbarPinnedStorage,
  migrateLegacyFormatToolbarPinned,
  needsFormatToolbarSettingsMigration,
  normalizeEditorFormatToolbarEnabled,
} from '../settings-runtime/editorFormatToolbarEnabled'
import { normalizeEditorSpellcheckEnabled } from '../settings-runtime/editorSpellcheck'
import { normalizeEditorUiChromeSettings } from '../settings-runtime/editorUiChrome'
import { normalizeAiSettings } from '../settings-runtime/aiSettings'
import { normalizeAutoLockMinutes } from '../settings-runtime/workspaceAutoLock'
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { isExternalThemeCssActive } from '../theme-runtime/themeColorSource'
import { isShortcutCustomizable } from '../menu/shortcutPlatformDefaults'
import { mirrorAppSettingsLocalCache } from '../platform/bootEarlyTheme'
import { getAppSettings, saveAppSettings } from '../platform/tauri/settingsService'
import {
  hydrateAiApiKeyFromSecureStore,
  persistAiApiKeyToSecureStore,
  stripAiApiKeyForDisk,
} from './aiApiKeyPersistence'

const LEGACY_WEB_STORAGE_KEY = 'CrossPlatNote:appSettings:v1'
const WEB_STORAGE_KEY = 'Lunote:appSettings:v1'

type EditorAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['editor']>
type WindowAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['window']>
type UiAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['ui']>
type SecuritySettings = NonNullable<AppSettingsState['security']>

function normalizeEditorAppearance(editor: Partial<EditorAppearance> | undefined) {
  const familyRaw = typeof editor?.fontFamily === 'string' ? editor.fontFamily.trim() : ''
  const fontSize = normalizeEditorFontSize(editor?.fontSize)
  const columnWidth = normalizeEditorColumnWidth(editor?.columnWidth)
  const legacyToolbarEnabled = migrateLegacyFormatToolbarPinned()
  const formatToolbarEnabled = normalizeEditorFormatToolbarEnabled(
    editor?.formatToolbarEnabled,
    (editor as { formatToolbarMode?: unknown } | undefined)?.formatToolbarMode ?? legacyToolbarEnabled,
  )
  const spellcheckEnabled = normalizeEditorSpellcheckEnabled(editor?.spellcheckEnabled)
  if (legacyToolbarEnabled !== undefined) clearLegacyFormatToolbarPinnedStorage()
  const autosaveScope: 'allDirty' | 'activeOnly' =
    editor?.autosaveScope === 'allDirty' ? 'allDirty' : 'activeOnly'
  const { formatToolbarMode: _legacyFormatToolbarMode, ...editorRest } =
    (editor as { formatToolbarMode?: unknown } | undefined) ?? {}
  return {
    ...editorRest,
    fontFamily: familyRaw || undefined,
    fontSize,
    columnWidth,
    formatToolbarEnabled,
    spellcheckEnabled,
    autosaveScope,
  }
}

function normalizeWindowAppearance(windowPrefs: Partial<WindowAppearance> | undefined) {
  return {
    closeToTrayEnabled: windowPrefs?.closeToTrayEnabled !== false,
  }
}

function normalizeSecuritySettings(security: Partial<SecuritySettings> | undefined | null): SecuritySettings {
  return {
    autoLockMinutes: normalizeAutoLockMinutes(security?.autoLockMinutes),
  }
}

export function normalizeAppSettingsState(settings: AppSettingsState): AppSettingsState {
  return {
    ...settings,
    assetStorage: normalizeAssetStorageConfig(settings.assetStorage),
    security: normalizeSecuritySettings(settings.security),
    ai: normalizeAiSettings(settings.ai),
    aiConnectionTest:
      typeof settings.aiConnectionTest?.ok === 'boolean' &&
      typeof settings.aiConnectionTest?.at === 'number'
        ? settings.aiConnectionTest
        : undefined,
    appearance: normalizeAppearance(settings.appearance),
  }
}

function normalizeUiAppearance(ui: Partial<UiAppearance> | undefined) {
  return normalizeEditorUiChromeSettings(ui)
}

function normalizeAppearance(appearance: AppSettingsState['appearance']): AppSettingsState['appearance'] {
  const existingTheme = { ...(appearance?.theme ?? {}) }
  delete (existingTheme as Record<string, unknown>).cssCompatMode
  const normalizedActive = normalizeThemeVariant(existingTheme.active)
  const theme = {
    ...existingTheme,
    active: normalizedActive,
  }
  if (!isExternalThemeCssActive(theme) && !theme.active) {
    theme.active = 'github-dark'
  }
  const existingEditor = normalizeEditorAppearance(appearance?.editor)
  const existingWindow = normalizeWindowAppearance(appearance?.window)
  const existingUi = normalizeUiAppearance(appearance?.ui)
  return {
    ...(appearance ?? {}),
    theme,
    editor: existingEditor,
    window: existingWindow,
    ui: existingUi,
  }
}

function normalizeAiConnectionTest(
  raw: AppSettingsState['aiConnectionTest'] | undefined,
): AppSettingsState['aiConnectionTest'] | undefined {
  if (
    typeof raw?.ok !== 'boolean' ||
    typeof raw?.at !== 'number' ||
    typeof raw?.provider !== 'string'
  ) {
    return undefined
  }
  return {
    ok: raw.ok,
    at: raw.at,
    provider: raw.provider,
  }
}

function parse(raw: string | null): AppSettingsState {
  if (!raw) return { ...DEFAULT_APP_SETTINGS }
  try {
    const v = JSON.parse(raw) as Partial<AppSettingsState>
    return {
      ...DEFAULT_APP_SETTINGS,
      ...v,
      version: typeof v.version === 'number' ? v.version : 1,
      language: (v.language as AppSettingsState['language']) ?? 'system',
      assetStorage: normalizeAssetStorageConfig(v.assetStorage),
      security: normalizeSecuritySettings(v.security),
      ai: normalizeAiSettings(v.ai),
      aiConnectionTest: normalizeAiConnectionTest(v.aiConnectionTest),
      appearance: normalizeAppearance(v.appearance),
      shortcutOverrides: normalizeShortcutOverrides(v.shortcutOverrides),
    }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

function normalizeShortcutOverrides(
  raw: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const [id, acc] of Object.entries(raw)) {
    if (typeof id !== 'string' || typeof acc !== 'string') continue
    if (!isShortcutCustomizable(id)) continue
    const trimmed = acc.trim()
    if (!trimmed) continue
    out[id] = trimmed
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function readAppSettingsLocalCache(): AppSettingsState | null {
  if (typeof localStorage === 'undefined') return null
  let raw = localStorage.getItem(WEB_STORAGE_KEY)
  if (!raw) {
    raw = localStorage.getItem(LEGACY_WEB_STORAGE_KEY)
  }
  if (!raw) return null
  return parse(raw)
}

export async function loadAppSettingsFromDisk(options?: { fallbackOnError?: boolean }): Promise<AppSettingsState> {
  const fallbackOnError = options?.fallbackOnError ?? true
  if (isTauri()) {
    try {
      const settings = await getAppSettings()
      const needsThemeCompatMigration = Boolean(
        (settings.appearance?.theme as Record<string, unknown> | undefined)?.cssCompatMode,
      )
      let normalized = normalizeAppSettingsState({
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        shortcutOverrides: normalizeShortcutOverrides(settings.shortcutOverrides),
      })
      const hydrated = await hydrateAiApiKeyFromSecureStore(normalized)
      normalized = hydrated.settings
      const needsFormatToolbarMigration = needsFormatToolbarSettingsMigration(settings.appearance?.editor)
      if (
        needsThemeCompatMigration ||
        needsFormatToolbarMigration ||
        hydrated.didMigrateFromSettings
      ) {
        void saveAppSettingsToDisk(normalized).catch((error) => {
          console.warn('[app-settings] Failed to migrate legacy settings.', error)
        })
      }
      // Never mirror the API key into localStorage on Tauri.
      mirrorAppSettingsLocalCache(JSON.stringify(stripAiApiKeyForDisk(normalized)))
      return normalized
    } catch (error) {
      if (!fallbackOnError) throw error
      return { ...DEFAULT_APP_SETTINGS }
    }
  }
  let raw = localStorage.getItem(WEB_STORAGE_KEY)
  if (!raw) {
    raw = localStorage.getItem(LEGACY_WEB_STORAGE_KEY)
    if (raw) {
      localStorage.setItem(WEB_STORAGE_KEY, raw)
      localStorage.removeItem(LEGACY_WEB_STORAGE_KEY)
    }
  }
  let needsThemeCompatMigration = false
  let needsFormatToolbarMigration: boolean
  if (raw) {
    try {
      const stored = JSON.parse(raw) as Partial<AppSettingsState>
      needsThemeCompatMigration = Boolean(
        (stored.appearance?.theme as Record<string, unknown> | undefined)?.cssCompatMode,
      )
      needsFormatToolbarMigration = needsFormatToolbarSettingsMigration(stored.appearance?.editor)
    } catch {
      needsThemeCompatMigration = false
      needsFormatToolbarMigration = false
    }
  } else {
    needsFormatToolbarMigration = true
  }
  const parsed = parse(raw)
  if (needsThemeCompatMigration || needsFormatToolbarMigration) {
    void saveAppSettingsToDisk(parsed)
  } else if (raw) {
    mirrorAppSettingsLocalCache(JSON.stringify(parsed))
  }
  return parsed
}

export async function saveAppSettingsToDisk(settings: AppSettingsState): Promise<void> {
  const normalized = normalizeAppSettingsState(settings)
  if (isTauri()) {
    const apiKey = typeof normalized.ai?.apiKey === 'string' ? normalized.ai.apiKey : ''
    let forDisk = stripAiApiKeyForDisk(normalized)
    try {
      await persistAiApiKeyToSecureStore(apiKey)
    } catch (error) {
      console.warn('[ai-api-key] Keychain persist failed; keeping key in settings JSON fallback', error)
      // Prefer not to block unrelated settings saves or drop the only copy of the key.
      forDisk = normalized
    }
    const serialized = JSON.stringify(forDisk)
    await saveAppSettings(forDisk)
    mirrorAppSettingsLocalCache(serialized)
    return
  }
  const serialized = JSON.stringify(normalized)
  localStorage.setItem(WEB_STORAGE_KEY, serialized)
}
