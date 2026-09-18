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
  /** Latest successful AI connection test result for connection-status chrome. */
  aiConnectionTest?: {
    ok: boolean
    at: number
    provider?: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'local' | 'ollama' | 'lmstudio'
  }
  /** commandId → accelerator (Mod+Shift+b); unlisted commands use manifest default*/
  shortcutOverrides?: Record<string, string>
  /** Startup update check preferences (production desktop builds). */
  updates?: {
    autoCheckEnabled?: boolean
  }
  /** Session security preferences (idle auto-lock). */
  security?: {
    /** Minutes without input before locking an unlocked encrypted workspace. 0 = never. Default 5. */
    autoLockMinutes?: number
  }
  /** AI assistant API connection (OpenAI, Anthropic, Gemini, etc.). */
  ai?: {
    provider?: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'local' | 'ollama' | 'lmstudio'
    apiKey?: string
    baseUrl?: string
    model?: string
    /** Include workspace search snippets in AI context (default true). */
    includeWorkspaceSearch?: boolean
    /** Include 1-hop linked note titles in AI context (default true). */
    includeGraphNeighbors?: boolean
    /** Extend graph context to 2-hop wiki links (default false). */
    graphTwoHop?: boolean
    /** When wiki-linked notes are referenced, skip workspace RAG search. */
    preferMentionContextOnly?: boolean
    /** Optional custom system prompt; overrides default when non-empty. */
    systemPrompt?: string
    /** Chat history scope: per active note (default) or one workspace-wide thread. */
    conversationScope?: 'per-note' | 'global'
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
      preset?: 'print-a4' | 'compact-a4' | 'share-wide' | 'letter'
      tocMode?: 'marker-only' | 'always' | 'off'
      pageBreakMode?: 'avoid-blocks' | 'flow'
    }
    window?: {
      /** When enabled, closing the main window hides it and keeps the app running in the background. */
      closeToTrayEnabled?: boolean
    }
    ui?: {
      /** Tab bar trailing focus mode icon button. */
      focusButtonEnabled?: boolean
      /** Tab bar trailing knowledge graph icon button. */
      graphButtonEnabled?: boolean
      /** Tab bar trailing AI assistant icon button. */
      aiButtonEnabled?: boolean
      /** Tab bar trailing global search icon button. */
      globalSearchButtonEnabled?: boolean
      noteCalendarButtonEnabled?: boolean
      /** @deprecated use globalSearchButtonEnabled */
      tabSwitcherButtonEnabled?: boolean
      /** Floating “exit focus” control while focus mode is active. */
      focusExitButtonEnabled?: boolean
      /** Footer line/char/heading counters. */
      documentStatsEnabled?: boolean
      /** Transient toast notifications (save confirmations, errors, etc.). */
      toastNotificationsEnabled?: boolean
      /** @deprecated use focusButtonEnabled + graphButtonEnabled */
      editorChromeButtonsEnabled?: boolean
    }
  } & Record<string, unknown>
}

export const DEFAULT_APP_SETTINGS: AppSettingsState = {
  version: 1,
  language: 'system',
  assetStorage: DEFAULT_ASSET_STORAGE_CONFIG,
  security: {
    autoLockMinutes: 5,
  },
  ai: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
  },
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
    window: {
      closeToTrayEnabled: true,
    },
    editor: {
      autosaveEnabled: true,
      autosaveIntervalSec: 60,
      autosaveScope: 'activeOnly',
      columnWidth: 860,
      formatToolbarEnabled: true,
      spellcheckEnabled: true,
    },
    ui: {
      focusButtonEnabled: true,
      graphButtonEnabled: true,
      aiButtonEnabled: true,
      globalSearchButtonEnabled: true,
      noteCalendarButtonEnabled: true,
      focusExitButtonEnabled: true,
      documentStatsEnabled: true,
      toastNotificationsEnabled: true,
    },
  },
}
