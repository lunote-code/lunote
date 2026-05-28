/**
 * Global application settings (decoupled from UI); see appSettingsPersistence for the only persistence entry.
 */
import type { AppLanguageSetting, AppSettingsState } from './appSettingsTypes'
import { DEFAULT_APP_SETTINGS } from './appSettingsTypes'
import { loadAppSettingsFromDisk, saveAppSettingsToDisk } from './appSettingsPersistence'
import type { AssetStorageConfig } from '../assets/assetStoragePolicy'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import { isShortcutCustomizable } from '../menu/shortcutPlatformDefaults'

type Sub = () => void

let snapshot: AppSettingsState = { ...DEFAULT_APP_SETTINGS }
let hydrated = false
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

export function getAppSettingsSnapshot(): AppSettingsState {
  return { ...snapshot }
}

export function subscribeAppSettings(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export async function hydrateAppSettingsStore(): Promise<void> {
  if (hydrated) return
  snapshot = await loadAppSettingsFromDisk()
  hydrated = true
  notify()
}

export async function setAppLanguage(language: AppLanguageSetting): Promise<void> {
  snapshot = { ...snapshot, language }
  await saveAppSettingsToDisk(snapshot)
  notify()
}

export async function setAssetStorageConfig(config: AssetStorageConfig): Promise<void> {
  snapshot = {
    ...snapshot,
    assetStorage: normalizeAssetStorageConfig(config),
  }
  await saveAppSettingsToDisk(snapshot)
  notify()
}

export async function setAppearanceSetting(path: string, value: unknown): Promise<void> {
  const appearance = { ...(snapshot.appearance ?? {}) }
  const theme = { ...((appearance.theme as Record<string, unknown> | undefined) ?? {}) }
  const editor = { ...((appearance.editor as Record<string, unknown> | undefined) ?? {}) }
  const exportPrefs = { ...((appearance.export as Record<string, unknown> | undefined) ?? {}) }

  if (path.startsWith('theme.')) {
    theme[path.slice('theme.'.length)] = value
    appearance.theme = theme
  } else if (path.startsWith('editor.')) {
    editor[path.slice('editor.'.length)] = value
    appearance.editor = editor
  } else if (path.startsWith('export.')) {
    exportPrefs[path.slice('export.'.length)] = value
    appearance.export = exportPrefs
  } else {
    appearance[path] = value
  }

  snapshot = {
    ...snapshot,
    appearance,
  }
  await saveAppSettingsToDisk(snapshot)
  notify()
}

export async function setUpdatesSetting(
  key: keyof NonNullable<AppSettingsState['updates']>,
  value: boolean,
): Promise<void> {
  snapshot = {
    ...snapshot,
    updates: {
      ...(snapshot.updates ?? {}),
      [key]: value,
    },
  }
  await saveAppSettingsToDisk(snapshot)
  notify()
}

export async function setShortcutOverrides(overrides: Record<string, string> | undefined): Promise<void> {
  const next: Record<string, string> = {}
  if (overrides) {
    for (const [id, acc] of Object.entries(overrides)) {
      const trimmed = acc.trim()
      if (trimmed) next[id] = trimmed
    }
  }
  snapshot = {
    ...snapshot,
    shortcutOverrides: Object.keys(next).length > 0 ? next : undefined,
  }
  await saveAppSettingsToDisk(snapshot)
  notify()
}

export async function setShortcutOverride(commandId: string, accelerator: string | null): Promise<void> {
  if (!isShortcutCustomizable(commandId)) return
  const prev = { ...(snapshot.shortcutOverrides ?? {}) }
  if (accelerator?.trim()) {
    prev[commandId] = accelerator.trim()
  } else {
    delete prev[commandId]
  }
  await setShortcutOverrides(Object.keys(prev).length > 0 ? prev : undefined)
}

export async function resetAllShortcutOverrides(): Promise<void> {
  await setShortcutOverrides(undefined)
}

export function markAppSettingsHydratedForTests(state: AppSettingsState) {
  snapshot = { ...state }
  hydrated = true
  notify()
}
