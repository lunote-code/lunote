/** App Settings (persistent JSON); aligned with Tauri `AppSettings`*/
import type { UiLocaleId } from '../i18n/localeRegistry'
import {
  DEFAULT_ASSET_STORAGE_CONFIG,
  type AssetStorageConfig,
} from '../assets/assetStoragePolicy'

export type AppLanguageSetting = 'system' | UiLocaleId

export type AppSettingsState = {
  version: number
  language: AppLanguageSetting
  lastWorkspaceRoot?: string | null
  lastWorkspaceId?: string | null
  assetStorage: AssetStorageConfig
  /** commandId → accelerator (Mod+Shift+b); unlisted commands use manifest default*/
  shortcutOverrides?: Record<string, string>
  /** Startup update check preferences (production desktop builds). */
  updates?: {
    autoCheckEnabled?: boolean
  }
  /** Reserved: Appearance/Editor, etc.*/
  appearance?: {
    theme?: {
      active?: string
      cssFile?: string
      cssImportFile?: string
      /** Inline CSS for web builds when theme files are not on disk. */
      cssContent?: string
      cssSnippets?: string
      cssSnippetImport?: string
      /** name -> css for web snippet imports */
      cssSnippetsInline?: string
      exportCssSnippets?: string
      exportCssFile?: string
      exportCssContent?: string
      exportCssImport?: string
      /** name -> css for web export style imports */
      exportCssSnippetsInline?: string
      customThemeFile?: string
      customThemeJSON?: string
    }
    editor?: {
      /** Only works in document visual mode and source code mode*/
      fontFamily?: string
      /** px，1–60 */
      fontSize?: number
      /** Reading column max width in px (560 / 720 / 860 / 960 / 1080 / 1200). */
      columnWidth?: number
      /** Show the formatting toolbar row in visual mode. */
      formatToolbarEnabled?: boolean
      /** Enable native spellcheck in document visual and source modes. */
      spellcheckEnabled?: boolean
      autosaveEnabled?: boolean
      /** seconds, 30–600*/
      autosaveIntervalSec?: number
      autosaveScope?: 'allDirty' | 'activeOnly'
    }
    export?: {
      preset?: 'print-a4' | 'compact-a4' | 'letter'
      tocMode?: 'marker-only' | 'always' | 'off'
      pageBreakMode?: 'avoid-blocks' | 'flow'
    }
  } & Record<string, unknown>
}

export const DEFAULT_APP_SETTINGS: AppSettingsState = {
  version: 1,
  language: 'system',
  assetStorage: DEFAULT_ASSET_STORAGE_CONFIG,
  appearance: {
    theme: {
      active: 'github-dark',
      cssFile: '',
      cssSnippets: '',
      exportCssSnippets: '',
      exportCssFile: '',
    },
    export: {
      preset: 'print-a4',
      tocMode: 'marker-only',
      pageBreakMode: 'avoid-blocks',
    },
    editor: {
      autosaveEnabled: true,
      autosaveIntervalSec: 120,
      autosaveScope: 'activeOnly',
      columnWidth: 860,
      formatToolbarEnabled: true,
      spellcheckEnabled: true,
    },
  },
}
