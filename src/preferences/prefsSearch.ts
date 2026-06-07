import type { TranslateFn } from '../i18n'
import { listCustomizableShortcutCommands } from '../menu/shortcutCustomization'
import { getFlatSettingsSchema } from '../settings-runtime/settingsRegistry'
import type { SettingsSectionId } from '../settings-runtime/settingsTypes'
import { PREFS_TAB_IDS, type PrefsTabId } from './types'

const TAB_LABEL_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.category.general',
  appearance: 'prefs.category.appearance',
  export: 'prefs.category.export',
  import: 'prefs.category.import',
  templates: 'prefs.category.templates',
  editor: 'prefs.category.editor',
  language: 'prefs.category.language',
  shortcuts: 'prefs.category.shortcuts',
}

/** Used for sidebar search: match category name with panel introduction copy*/
const TAB_SEARCH_KEY: Record<PrefsTabId, string> = {
  general: 'prefs.section.general.lead',
  appearance: 'prefs.section.appearance.lead',
  export: 'prefs.section.export.lead',
  import: 'prefs.section.import.lead',
  templates: 'prefs.section.templates.lead',
  editor: 'prefs.section.editor.lead',
  language: 'prefs.section.language.intro',
  shortcuts: 'prefs.section.shortcuts.lead',
}

function settingsTabMatchesQuery(t: TranslateFn, section: SettingsSectionId, q: string): boolean {
  for (const item of getFlatSettingsSchema()) {
    if (item.section !== section) continue
    const label = t(item.labelKey).toLowerCase()
    if (label.includes(q)) return true
    if (item.descriptionKey && t(item.descriptionKey).toLowerCase().includes(q)) return true
  }
  return false
}

function exportTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const lead = t(TAB_SEARCH_KEY.export).toLowerCase()
  if (lead.includes(q)) return true
  for (const item of getFlatSettingsSchema()) {
    if (item.section !== 'export') continue
    const label = t(item.labelKey).toLowerCase()
    if (label.includes(q)) return true
    if (item.descriptionKey && t(item.descriptionKey).toLowerCase().includes(q)) return true
  }
  return false
}

const TEMPLATE_SEARCH_KEYS = [
  'settings.workspaceNotes.dailyEnabled.label',
  'settings.workspaceNotes.dailyFolder.label',
  'settings.workspaceNotes.dailyFormat.label',
  'settings.workspaceNotes.dailyTemplate.label',
  'settings.workspaceNotes.openOnStartup.label',
  'settings.workspaceNotes.templatesFolder.label',
  'settings.workspaceNotes.defaultTemplate.label',
  'settings.workspaceNotes.openToday',
  'settings.workspaceNotes.variablesTitle',
] as const

function templatesTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const lead = t(TAB_SEARCH_KEY.templates).toLowerCase()
  if (lead.includes(q)) return true
  return TEMPLATE_SEARCH_KEYS.some((key) => t(key).toLowerCase().includes(q))
}

function shortcutsTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const lead = t(TAB_SEARCH_KEY.shortcuts).toLowerCase()
  if (lead.includes(q)) return true
  for (const entry of listCustomizableShortcutCommands()) {
    const label = t(entry.labelKey).toLowerCase()
    if (label.includes(q)) return true
  }
  return false
}

export function filterPrefsTabs(t: TranslateFn, query: string): PrefsTabId[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...PREFS_TAB_IDS]
  return PREFS_TAB_IDS.filter((tab) => {
    if (tab === 'export') return exportTabMatchesQuery(t, q)
    if (tab === 'templates') return templatesTabMatchesQuery(t, q)
    if (tab === 'shortcuts') return shortcutsTabMatchesQuery(t, q)
    if (settingsTabMatchesQuery(t, tab, q)) return true
    const hay = `${t(TAB_LABEL_KEY[tab])} ${t(TAB_SEARCH_KEY[tab])}`.toLowerCase()
    return hay.includes(q)
  })
}
