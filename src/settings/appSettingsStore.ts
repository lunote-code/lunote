/**
 * Global application settings (decoupled from UI); see appSettingsPersistence for the only persistence entry.
 */
import { logError, logWarn } from '../lib/lunaLogger'
import type { AppLanguageSetting, AppSettingsState } from './appSettingsTypes'
import { DEFAULT_APP_SETTINGS } from './appSettingsTypes'
import {
  loadAppSettingsFromDisk,
  normalizeAppSettingsState,
  saveAppSettingsToDisk,
} from './appSettingsPersistence'
import type { AssetStorageConfig } from '../assets/assetStoragePolicy'
import { normalizeAssetStorageConfig } from '../assets/assetStoragePolicy'
import { isShortcutCustomizable } from '../menu/shortcutPlatformDefaults'
import { workspaceIdFromRoot } from '../lib/workspacePathUtils'

type Sub = () => void

let snapshot: AppSettingsState = { ...DEFAULT_APP_SETTINGS }
let hydrated = false
let writable = true
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

function summarizeSettingsSnapshot(state: AppSettingsState) {
  return {
    language: state.language,
    lastWorkspaceRoot: state.lastWorkspaceRoot ?? null,
    lastWorkspaceId: state.lastWorkspaceId ?? null,
  }
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

export type HydrateAppSettingsOptions = {
  /** Reload from disk even when the in-memory store was already hydrated. */
  force?: boolean
}

export async function hydrateAppSettingsStore(options?: HydrateAppSettingsOptions): Promise<void> {
  const force = options?.force ?? false
  if (hydrated && !force) {
    console.info('[app-settings] hydrate skipped (already hydrated)', summarizeSettingsSnapshot(snapshot), {
      writable,
    })
    return
  }
  try {
    snapshot = await loadAppSettingsFromDisk({ fallbackOnError: false })
    writable = true
    console.info('[app-settings] hydrate ok', summarizeSettingsSnapshot(snapshot), { writable, force })
  } catch (error) {
    writable = false
    logWarn('[app-settings] hydrate failed; keeping in-memory defaults only.', {
      snapshot: summarizeSettingsSnapshot(snapshot),
      writable,
      force,
      error,
    })
  }
  hydrated = true
  notify()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    hydrated = false
    writable = true
    snapshot = { ...DEFAULT_APP_SETTINGS }
    console.info('[app-settings] HMR dispose: reset in-memory settings store')
  })
}

async function persistSnapshot(): Promise<void> {
  if (!writable) {
    logWarn('[app-settings] save skipped (writable=false)', summarizeSettingsSnapshot(snapshot))
    return
  }
  snapshot = normalizeAppSettingsState(snapshot)
  try {
    await saveAppSettingsToDisk(snapshot)
    console.info('[app-settings] save ok', summarizeSettingsSnapshot(snapshot))
  } catch (error) {
    logError('[app-settings] save failed', {
      snapshot: summarizeSettingsSnapshot(snapshot),
      error,
    })
    throw error
  }
}

export async function setAppLanguage(language: AppLanguageSetting): Promise<void> {
  snapshot = { ...snapshot, language }
  await persistSnapshot()
  notify()
}

export async function setAssetStorageConfig(config: AssetStorageConfig): Promise<void> {
  snapshot = {
    ...snapshot,
    assetStorage: normalizeAssetStorageConfig(config),
  }
  await persistSnapshot()
  notify()
}

/** Clears persisted workspace restore hints (e.g. after the user closes the workspace). */
export async function clearLastWorkspaceSettings(): Promise<void> {
  snapshot = {
    ...snapshot,
    lastWorkspaceRoot: null,
    lastWorkspaceId: null,
  }
  await persistSnapshot()
  notify()
}

export async function setLastWorkspaceSettings(rootDir: string): Promise<void> {
  const trimmedRoot = rootDir.trim()
  if (!trimmedRoot) {
    await clearLastWorkspaceSettings()
    return
  }
  snapshot = {
    ...snapshot,
    lastWorkspaceRoot: trimmedRoot,
    lastWorkspaceId: workspaceIdFromRoot(trimmedRoot),
  }
  await persistSnapshot()
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
    const editorKey = path.slice('editor.'.length)
    editor[editorKey] = value
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
  await persistSnapshot()
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
  await persistSnapshot()
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
  await persistSnapshot()
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
  writable = true
  notify()
}
