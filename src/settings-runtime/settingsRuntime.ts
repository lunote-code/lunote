import { logError } from '../lib/lunaLogger'
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
import {
  normalizeEditorColumnWidth,
  resolveEffectiveEditorColumnWidth,
} from './editorColumnWidth'
import { resolveEditorFormatToolbarEnabled } from './editorFormatToolbarEnabled'
import { resolveEditorSpellcheckEnabled } from './editorSpellcheck'
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
    case 'theme.cssContent':
      return snapshot.appearance?.theme?.cssContent ?? ''
    case 'theme.cssImportFile':
      return snapshot.appearance?.theme?.cssImportFile ?? ''
    case 'theme.cssSnippetImport':
      return snapshot.appearance?.theme?.cssSnippetImport ?? ''
    case 'theme.cssSnippetsInline':
      return snapshot.appearance?.theme?.cssSnippetsInline ?? ''
    case 'theme.cssSnippets':
      return snapshot.appearance?.theme?.cssSnippets ?? ''
    case 'theme.exportCssFile':
      return snapshot.appearance?.theme?.exportCssFile ?? ''
    case 'theme.exportCssContent':
      return snapshot.appearance?.theme?.exportCssContent ?? ''
    case 'theme.exportCssImport':
      return snapshot.appearance?.theme?.exportCssImport ?? ''
    case 'theme.exportCssSnippetsInline':
      return snapshot.appearance?.theme?.exportCssSnippetsInline ?? ''
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
    case 'editor.columnWidth':
      return String(resolveEffectiveEditorColumnWidth(snapshot.appearance?.editor?.columnWidth))
    case 'editor.formatToolbarEnabled':
      return resolveEditorFormatToolbarEnabled(snapshot.appearance?.editor)
    case 'editor.spellcheckEnabled':
      return resolveEditorSpellcheckEnabled(snapshot.appearance?.editor)
    case 'editor.autosaveEnabled':
      return snapshot.appearance?.editor?.autosaveEnabled !== false
    case 'editor.autosaveIntervalSec':
      return String(snapshot.appearance?.editor?.autosaveIntervalSec ?? 120)
    case 'editor.autosaveScope':
      return snapshot.appearance?.editor?.autosaveScope === 'allDirty' ? 'allDirty' : 'activeOnly'
    case 'window.closeToTrayEnabled':
      return snapshot.appearance?.window?.closeToTrayEnabled !== false
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
    case 'general.language': {
      const language = String(value) as AppLanguageSetting
      console.info('[app-settings] set language', { language })
      await setAppLanguage(language)
      console.info('[app-settings] set language done', { language })
      return
    }
    case 'theme.active':
      await setAppearanceSetting('theme.active', normalizeThemeVariant(value))
      return
    case 'theme.cssFile':
      await setAppearanceSetting('theme.cssFile', typeof value === 'string' ? value.trim() : '')
      return
    case 'theme.cssContent':
      await setAppearanceSetting('theme.cssContent', typeof value === 'string' ? value : '')
      return
    case 'theme.cssImportFile':
      await setAppearanceSetting('theme.cssImportFile', typeof value === 'string' ? value : '')
      return
    case 'theme.cssSnippetImport':
      await setAppearanceSetting('theme.cssSnippetImport', typeof value === 'string' ? value : '')
      return
    case 'theme.cssSnippetsInline':
      await setAppearanceSetting('theme.cssSnippetsInline', typeof value === 'string' ? value : '')
      return
    case 'theme.cssSnippets':
      await setAppearanceSetting('theme.cssSnippets', typeof value === 'string' ? value : '')
      return
    case 'theme.exportCssFile':
      await setAppearanceSetting('theme.exportCssFile', typeof value === 'string' ? value.trim() : '')
      return
    case 'theme.exportCssContent':
      await setAppearanceSetting('theme.exportCssContent', typeof value === 'string' ? value : '')
      return
    case 'theme.exportCssImport':
      await setAppearanceSetting('theme.exportCssImport', typeof value === 'string' ? value : '')
      return
    case 'theme.exportCssSnippetsInline':
      await setAppearanceSetting(
        'theme.exportCssSnippetsInline',
        typeof value === 'string' ? value : '',
      )
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
    case 'editor.columnWidth': {
      await setAppearanceSetting('editor.columnWidth', normalizeEditorColumnWidth(value))
      return
    }
    case 'editor.formatToolbarEnabled':
      await setAppearanceSetting('editor.formatToolbarEnabled', Boolean(value))
      return
    case 'editor.spellcheckEnabled':
      await setAppearanceSetting('editor.spellcheckEnabled', Boolean(value))
      return
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
    case 'window.closeToTrayEnabled':
      await setAppearanceSetting('window.closeToTrayEnabled', Boolean(value))
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
  try {
    await writeValue(path, value)
  } catch (error) {
    logError('[app-settings] setSetting failed', { path, value, error })
    throw error
  }
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
