export type PrefsTabId =
  | 'general'
  | 'appearance'
  | 'interface'
  | 'export'
  | 'import'
  | 'templates'
  | 'encryption'
  | 'editor'
  | 'language'
  | 'ai'
  | 'shortcuts'
  | 'plugins'

export const PREFS_TAB_IDS: readonly PrefsTabId[] = [
  'general',
  'appearance',
  'interface',
  'export',
  'import',
  'templates',
  'encryption',
  'editor',
  'language',
  'ai',
  'shortcuts',
  'plugins',
]

export const PREFS_ACTIVE_TAB_STORAGE_KEY = 'prefs.dialog.activeTab'
