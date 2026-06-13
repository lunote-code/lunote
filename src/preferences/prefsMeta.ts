import type { PrefsTabId } from './types'

export const PREFS_TAB_TITLE_KEY: Record<PrefsTabId, string> = {
  general: 'settings.sidebar.general',
  appearance: 'settings.sidebar.appearance',
  export: 'settings.sidebar.export',
  import: 'settings.sidebar.import',
  templates: 'settings.sidebar.templates',
  editor: 'settings.sidebar.editor',
  language: 'settings.sidebar.language',
  shortcuts: 'settings.sidebar.shortcuts',
  plugins: 'settings.sidebar.plugins',
}

export const PREFS_TAB_DESCRIPTION_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.section.general.lead',
  appearance: 'prefs.section.appearance.lead',
  export: 'prefs.section.export.lead',
  import: 'prefs.section.import.lead',
  templates: 'prefs.section.templates.lead',
  editor: 'prefs.section.editor.lead',
  language: 'prefs.section.language.intro',
  shortcuts: 'prefs.section.shortcuts.lead',
  plugins: 'prefs.section.plugins.lead',
}

export const PREFS_TAB_CATEGORY_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.category.general',
  appearance: 'prefs.category.appearance',
  export: 'prefs.category.export',
  import: 'prefs.category.import',
  templates: 'prefs.category.templates',
  editor: 'prefs.category.editor',
  language: 'prefs.category.language',
  shortcuts: 'prefs.category.shortcuts',
  plugins: 'prefs.category.plugins',
}
