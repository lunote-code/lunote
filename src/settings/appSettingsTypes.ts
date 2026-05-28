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
      cssCompatMode?: 'native' | 'obsidian-auto'
      cssSnippets?: string
      exportCssSnippets?: string
      customThemeFile?: string
      customThemeJSON?: string
    }
    editor?: {
      /** Only works in document visual mode and source code mode*/
      fontFamily?: string
      /** px，1–60 */
      fontSize?: number
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
      cssCompatMode: 'obsidian-auto',
      cssSnippets: '',
      exportCssSnippets: '',
    },
    export: {
      preset: 'print-a4',
      tocMode: 'marker-only',
      pageBreakMode: 'avoid-blocks',
    },
  },
}
