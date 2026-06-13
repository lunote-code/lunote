import type { TranslateFn } from '../i18n'
import { listCustomizableShortcutCommands } from '../menu/shortcutCustomization'
import { getFlatSettingsSchema } from '../settings-runtime/settingsRegistry'
import type { SettingsSectionId } from '../settings-runtime/settingsTypes'
import { PREFS_TAB_CATEGORY_KEY, PREFS_TAB_DESCRIPTION_KEY } from './prefsMeta'
import { PREFS_TAB_IDS, type PrefsTabId } from './types'

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
  const lead = t(PREFS_TAB_DESCRIPTION_KEY.export).toLowerCase()
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
  'settings.workspaceNotes.variablesTitle',
] as const

function templatesTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const lead = t(PREFS_TAB_DESCRIPTION_KEY.templates).toLowerCase()
  if (lead.includes(q)) return true
  return TEMPLATE_SEARCH_KEYS.some((key) => t(key).toLowerCase().includes(q))
}

function shortcutsTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const lead = t(PREFS_TAB_DESCRIPTION_KEY.shortcuts).toLowerCase()
  if (lead.includes(q)) return true
  for (const entry of listCustomizableShortcutCommands()) {
    const label = t(entry.labelKey).toLowerCase()
    if (label.includes(q)) return true
  }
  return false
}

function pluginsTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const hay = [
    t(PREFS_TAB_CATEGORY_KEY.plugins),
    t(PREFS_TAB_DESCRIPTION_KEY.plugins),
    t('settings.plugins.searchPlaceholder'),
    t('settings.plugins.tabBrowse'),
    t('settings.plugins.tabInstalled'),
    t('settings.plugins.install'),
    t('settings.plugins.uninstall'),
    t('settings.plugins.update'),
    t('settings.plugins.refresh'),
    t('settings.plugins.refreshInstalled'),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function filterPrefsTabs(t: TranslateFn, query: string): PrefsTabId[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...PREFS_TAB_IDS]
  return PREFS_TAB_IDS.filter((tab) => {
    if (tab === 'export') return exportTabMatchesQuery(t, q)
    if (tab === 'templates') return templatesTabMatchesQuery(t, q)
    if (tab === 'shortcuts') return shortcutsTabMatchesQuery(t, q)
    if (tab === 'plugins') return pluginsTabMatchesQuery(t, q)
    if (settingsTabMatchesQuery(t, tab, q)) return true
    const hay = `${t(PREFS_TAB_CATEGORY_KEY[tab])} ${t(PREFS_TAB_DESCRIPTION_KEY[tab])}`.toLowerCase()
    return hay.includes(q)
  })
}
