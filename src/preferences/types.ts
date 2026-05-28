export type PrefsTabId = 'general' | 'appearance' | 'export' | 'editor' | 'language' | 'shortcuts'

export const PREFS_TAB_IDS: readonly PrefsTabId[] = [
  'general',
  'appearance',
  'export',
  'editor',
  'language',
  'shortcuts',
]

export const PREFS_ACTIVE_TAB_STORAGE_KEY = 'prefs.dialog.activeTab'
