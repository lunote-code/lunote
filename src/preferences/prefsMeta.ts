import type { PrefsTabId } from './types'

export const PREFS_TAB_TITLE_KEY: Record<PrefsTabId, string> = {
  general: 'settings.sidebar.general',
  appearance: 'settings.sidebar.appearance',
  interface: 'settings.sidebar.interface',
  export: 'settings.sidebar.export',
  import: 'settings.sidebar.import',
  templates: 'settings.sidebar.templates',
  encryption: 'settings.sidebar.security',
  editor: 'settings.sidebar.editor',
  language: 'settings.sidebar.language',
  ai: 'settings.sidebar.ai',
  shortcuts: 'settings.sidebar.shortcuts',
  plugins: 'settings.sidebar.plugins',
}

export const PREFS_TAB_DESCRIPTION_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.section.general.lead',
  appearance: 'prefs.section.appearance.lead',
  interface: 'prefs.section.interface.lead',
  export: 'prefs.section.export.lead',
  import: 'prefs.section.import.lead',
  templates: 'prefs.section.templates.lead',
  encryption: 'workspace.encryption.description',
  editor: 'prefs.section.editor.lead',
  language: 'prefs.section.language.intro',
  ai: 'prefs.section.ai.lead',
  shortcuts: 'prefs.section.shortcuts.lead',
  plugins: 'prefs.section.plugins.lead',
}

export const PREFS_TAB_CATEGORY_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.category.general',
  appearance: 'prefs.category.appearance',
  interface: 'prefs.category.interface',
  export: 'prefs.category.export',
  import: 'prefs.category.import',
  templates: 'prefs.category.templates',
  encryption: 'settings.sidebar.security',
  editor: 'prefs.category.editor',
  language: 'prefs.category.language',
  ai: 'prefs.category.ai',
  shortcuts: 'prefs.category.shortcuts',
  plugins: 'prefs.category.plugins',
}
