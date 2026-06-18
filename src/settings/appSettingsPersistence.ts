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
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { isShortcutCustomizable } from '../menu/shortcutPlatformDefaults'
import { mirrorAppSettingsLocalCache } from '../platform/bootEarlyTheme'
import { getAppSettings, saveAppSettings } from '../platform/tauri/settingsService'

const LEGACY_WEB_STORAGE_KEY = 'CrossPlatNote:appSettings:v1'
const WEB_STORAGE_KEY = 'Lunote:appSettings:v1'

type EditorAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['editor']>
type WindowAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['window']>

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

export function normalizeAppSettingsState(settings: AppSettingsState): AppSettingsState {
  return {
    ...settings,
    assetStorage: normalizeAssetStorageConfig(settings.assetStorage),
    appearance: normalizeAppearance(settings.appearance),
  }
}

function normalizeAppearance(appearance: AppSettingsState['appearance']): AppSettingsState['appearance'] {
  const existingTheme = { ...(appearance?.theme ?? {}) }
  delete (existingTheme as Record<string, unknown>).cssCompatMode
  const existingEditor = normalizeEditorAppearance(appearance?.editor)
  const existingWindow = normalizeWindowAppearance(appearance?.window)
  return {
    ...(appearance ?? {}),
    theme: {
      ...existingTheme,
      active: normalizeThemeVariant(existingTheme.active),
    },
    editor: existingEditor,
    window: existingWindow,
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

export async function loadAppSettingsFromDisk(options?: { fallbackOnError?: boolean }): Promise<AppSettingsState> {
  const fallbackOnError = options?.fallbackOnError ?? true
  if (isTauri()) {
    try {
      const settings = await getAppSettings()
      const needsThemeCompatMigration = Boolean(
        (settings.appearance?.theme as Record<string, unknown> | undefined)?.cssCompatMode,
      )
      const normalized = normalizeAppSettingsState({
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        shortcutOverrides: normalizeShortcutOverrides(settings.shortcutOverrides),
      })
      const needsFormatToolbarMigration = needsFormatToolbarSettingsMigration(settings.appearance?.editor)
      if (needsThemeCompatMigration || needsFormatToolbarMigration) {
        void saveAppSettings(normalized).catch((error) => {
          console.warn('[app-settings] Failed to migrate legacy appearance settings.', error)
        })
      }
      mirrorAppSettingsLocalCache(JSON.stringify(normalized))
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
  const serialized = JSON.stringify(normalized)
  if (isTauri()) {
    await saveAppSettings(normalized)
    mirrorAppSettingsLocalCache(serialized)
    return
  }
  localStorage.setItem(WEB_STORAGE_KEY, serialized)
}
