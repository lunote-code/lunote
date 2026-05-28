import { isTauri } from '@tauri-apps/api/core'
import type { AppSettingsState } from './appSettingsTypes'
import { DEFAULT_APP_SETTINGS } from './appSettingsTypes'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import { normalizeEditorFontSize } from '../settings-runtime/editorTypography'
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { isShortcutCustomizable } from '../menu/shortcutPlatformDefaults'
import { getAppSettings, saveAppSettings } from '../platform/tauri/settingsService'

const WEB_STORAGE_KEY = 'CrossPlatNote:appSettings:v1'

type EditorAppearance = NonNullable<NonNullable<AppSettingsState['appearance']>['editor']>

function normalizeEditorAppearance(editor: Partial<EditorAppearance> | undefined) {
  const familyRaw = typeof editor?.fontFamily === 'string' ? editor.fontFamily.trim() : ''
  const fontSize = normalizeEditorFontSize(editor?.fontSize)
  return {
    ...(editor ?? {}),
    fontFamily: familyRaw || undefined,
    fontSize,
  }
}

function normalizeAppearance(appearance: AppSettingsState['appearance']): AppSettingsState['appearance'] {
  const existingTheme = appearance?.theme ?? {}
  const existingEditor = normalizeEditorAppearance(appearance?.editor)
  return {
    ...(appearance ?? {}),
    theme: {
      ...existingTheme,
      active: normalizeThemeVariant(existingTheme.active),
    },
    editor: existingEditor,
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

export async function loadAppSettingsFromDisk(): Promise<AppSettingsState> {
  if (isTauri()) {
    try {
      const settings = await getAppSettings()
      return {
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        assetStorage: normalizeAssetStorageConfig(settings.assetStorage),
        appearance: normalizeAppearance(settings.appearance),
        shortcutOverrides: normalizeShortcutOverrides(settings.shortcutOverrides),
      }
    } catch {
      return { ...DEFAULT_APP_SETTINGS }
    }
  }
  return parse(localStorage.getItem(WEB_STORAGE_KEY))
}

export async function saveAppSettingsToDisk(settings: AppSettingsState): Promise<void> {
  if (isTauri()) {
    await saveAppSettings(settings)
    return
  }
  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(settings))
}
