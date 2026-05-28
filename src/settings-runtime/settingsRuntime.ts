import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import {
  getAppSettingsSnapshot,
  setAppearanceSetting,
  setAppLanguage,
  setAssetStorageConfig,
  setUpdatesSetting,
  subscribeAppSettings,
} from '../settings/appSettingsStore'
import { normPath } from '../lib/workspacePathUtils'
import { normalizeAssetStorageConfig, type AssetStorageConfig } from '../assets/assetStoragePolicy'
import {
  normalizeExportPageBreakMode,
  normalizeExportPresetId,
  normalizeExportTocMode,
} from '../export/exportPreset'
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { normalizeEditorFontSize, resolveEffectiveEditorFontSize } from './editorTypography'
import type { SettingsValue } from './settingsTypes'

type SettingsRuntimeSubscriber = () => void
let runtimeVersion = 0

function readValue(path: string): SettingsValue {
  const snapshot = getAppSettingsSnapshot()
  const assetStorage = normalizeAssetStorageConfig(snapshot.assetStorage)

  switch (path) {
    case 'assets.storage.mode':
      return assetStorage.mode
    case 'assets.relative.folderTemplate':
      return assetStorage.relativeFolderName
    case 'assets.absolute.path':
      return assetStorage.absolutePath
    case 'general.language':
      return snapshot.language
    case 'theme.active':
      return normalizeThemeVariant(snapshot.appearance?.theme?.active)
    case 'theme.cssFile':
      return snapshot.appearance?.theme?.cssFile ?? ''
    case 'theme.cssCompatMode':
      return snapshot.appearance?.theme?.cssCompatMode === 'native' ? 'native' : 'obsidian-auto'
    case 'theme.cssSnippets':
      return snapshot.appearance?.theme?.cssSnippets ?? ''
    case 'theme.exportCssSnippets':
      return snapshot.appearance?.theme?.exportCssSnippets ?? ''
    case 'theme.customThemeFile':
      return snapshot.appearance?.theme?.customThemeFile ?? ''
    case 'theme.customThemeJSON':
      return snapshot.appearance?.theme?.customThemeJSON ?? ''
    case 'export.preset':
      return normalizeExportPresetId(snapshot.appearance?.export?.preset)
    case 'export.tocMode':
      return normalizeExportTocMode(snapshot.appearance?.export?.tocMode)
    case 'export.pageBreakMode':
      return normalizeExportPageBreakMode(snapshot.appearance?.export?.pageBreakMode)
    case 'editor.fontFamily':
      return snapshot.appearance?.editor?.fontFamily ?? ''
    case 'editor.fontSize':
      return String(resolveEffectiveEditorFontSize(snapshot.appearance?.editor?.fontSize))
    case 'editor.autosaveEnabled':
      return snapshot.appearance?.editor?.autosaveEnabled !== false
    case 'editor.autosaveIntervalSec':
      return String(snapshot.appearance?.editor?.autosaveIntervalSec ?? 120)
    case 'editor.autosaveScope':
      return snapshot.appearance?.editor?.autosaveScope === 'allDirty' ? 'allDirty' : 'activeOnly'
    case 'updates.autoCheckEnabled':
      return snapshot.updates?.autoCheckEnabled !== false
    default:
      return undefined
  }
}

async function writeValue(path: string, value: SettingsValue): Promise<void> {
  const snapshot = getAppSettingsSnapshot()
  const assetStorage = normalizeAssetStorageConfig(snapshot.assetStorage)

  switch (path) {
    case 'assets.storage.mode':
      await setAssetStorageConfig({
        ...assetStorage,
        mode: value === 'absolute_path' ? 'absolute_path' : 'relative_to_document',
      })
      return
    case 'assets.relative.folderTemplate':
      await setAssetStorageConfig({
        ...assetStorage,
        relativeFolderName: typeof value === 'string' ? value : '',
      })
      return
    case 'assets.absolute.path':
      await setAssetStorageConfig({
        ...assetStorage,
        absolutePath:
          typeof value === 'string' ? normPath(value.trim()) : '',
      })
      return
    case 'general.language':
      await setAppLanguage(String(value) as AppLanguageSetting)
      return
    case 'theme.active':
      await setAppearanceSetting('theme.active', normalizeThemeVariant(value))
      return
    case 'theme.cssFile':
      await setAppearanceSetting('theme.cssFile', typeof value === 'string' ? value.trim() : '')
      return
    case 'theme.cssCompatMode':
      await setAppearanceSetting(
        'theme.cssCompatMode',
        value === 'native' ? 'native' : 'obsidian-auto',
      )
      return
    case 'theme.cssSnippets':
      await setAppearanceSetting('theme.cssSnippets', typeof value === 'string' ? value : '')
      return
    case 'theme.exportCssSnippets':
      await setAppearanceSetting('theme.exportCssSnippets', typeof value === 'string' ? value : '')
      return
    case 'theme.customThemeFile':
      await setAppearanceSetting('theme.customThemeFile', typeof value === 'string' ? value : '')
      return
    case 'theme.customThemeJSON':
      await setAppearanceSetting('theme.customThemeJSON', typeof value === 'string' ? value : '')
      return
    case 'export.preset':
      await setAppearanceSetting('export.preset', normalizeExportPresetId(value))
      return
    case 'export.tocMode':
      await setAppearanceSetting('export.tocMode', normalizeExportTocMode(value))
      return
    case 'export.pageBreakMode':
      await setAppearanceSetting('export.pageBreakMode', normalizeExportPageBreakMode(value))
      return
    case 'editor.fontFamily':
      await setAppearanceSetting('editor.fontFamily', typeof value === 'string' ? value.trim() : '')
      return
    case 'editor.fontSize': {
      const trimmed = typeof value === 'string' ? value.trim() : value
      const normalized =
        trimmed === '' || trimmed === null || trimmed === undefined
          ? undefined
          : normalizeEditorFontSize(trimmed)
      await setAppearanceSetting('editor.fontSize', normalized)
      return
    }
    case 'editor.autosaveEnabled':
      await setAppearanceSetting('editor.autosaveEnabled', Boolean(value))
      return
    case 'editor.autosaveIntervalSec': {
      const n = Number(typeof value === 'string' ? value.trim() : value)
      const clamped = Number.isFinite(n) ? Math.max(30, Math.min(600, Math.round(n))) : 120
      await setAppearanceSetting('editor.autosaveIntervalSec', clamped)
      return
    }
    case 'editor.autosaveScope':
      await setAppearanceSetting(
        'editor.autosaveScope',
        value === 'allDirty' ? 'allDirty' : 'activeOnly',
      )
      return
    case 'updates.autoCheckEnabled':
      await setUpdatesSetting('autoCheckEnabled', Boolean(value))
      return
    default:
      return
  }
}

export function getSetting(path: string): SettingsValue {
  return readValue(path)
}

export async function setSetting(path: string, value: SettingsValue): Promise<void> {
  await writeValue(path, value)
}

export function subscribe(path: string, callback: SettingsRuntimeSubscriber): () => void {
  let previous = readValue(path)
  return subscribeAppSettings(() => {
    const next = readValue(path)
    if (Object.is(previous, next)) return
    previous = next
    callback()
  })
}

export function subscribeAll(callback: SettingsRuntimeSubscriber): () => void {
  return subscribeAppSettings(() => {
    runtimeVersion += 1
    callback()
  })
}

export function getAssetStorageConfig(): AssetStorageConfig {
  return normalizeAssetStorageConfig(getAppSettingsSnapshot().assetStorage)
}

export function getSettingsRuntimeVersion(): number {
  return runtimeVersion
}
