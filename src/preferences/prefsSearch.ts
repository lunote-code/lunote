import type { TranslateFn } from '../i18n'
import { listCustomizableShortcutCommands } from '../menu/shortcutCustomization'
import { getFlatSettingsSchema, getSection, getSetting } from '../settings-runtime/settingsRegistry'
import type { SettingsSectionId } from '../settings-runtime/settingsTypes'
import { PREFS_TAB_CATEGORY_KEY, PREFS_TAB_DESCRIPTION_KEY } from './prefsMeta'
import { PREFS_TAB_IDS, type PrefsTabId } from './types'
import type { PrefsSectionTabId, PrefsSectionTabsDefinition } from './prefsSectionTabsMeta'

function settingLabelMatchesQuery(t: TranslateFn, labelKey: string, descriptionKey: string | undefined, q: string): boolean {
  const label = t(labelKey).toLowerCase()
  if (label.includes(q)) return true
  if (descriptionKey && t(descriptionKey).toLowerCase().includes(q)) return true
  return false
}

function settingsTabMatchesQuery(t: TranslateFn, section: SettingsSectionId, q: string): boolean {
  for (const item of getFlatSettingsSchema()) {
    if (item.section !== section) continue
    if (settingLabelMatchesQuery(t, item.labelKey, item.descriptionKey, q)) return true
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
  'settings.workspaceNotes.templatesEnabled.label',
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
    t('settings.plugins.earlyAccessNotice'),
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

function encryptionTabMatchesQuery(t: TranslateFn, q: string): boolean {
  const hay = [
    t('settings.sidebar.security'),
    t('workspace.encryption.title'),
    t('workspace.encryption.description'),
    t('workspace.encryption.password'),
    t('workspace.encryption.enable'),
    t('workspace.encryption.changePassword'),
    t('workspace.encryption.remove.action'),
    t('workspace.encryption.encryptImages.label'),
    t('workspace.encryption.encryptImages.description'),
    t('workspace.encryption.autoLock.label'),
    t('workspace.encryption.autoLock.description'),
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
    if (tab === 'encryption') return encryptionTabMatchesQuery(t, q)
    if (tab === 'shortcuts') return shortcutsTabMatchesQuery(t, q)
    if (tab === 'plugins') return pluginsTabMatchesQuery(t, q)
    if (settingsTabMatchesQuery(t, tab, q)) return true
    const hay = `${t(PREFS_TAB_CATEGORY_KEY[tab])} ${t(PREFS_TAB_DESCRIPTION_KEY[tab])}`.toLowerCase()
    return hay.includes(q)
  })
}

export function findFirstMatchingPrefsSectionTab(
  t: TranslateFn,
  definition: PrefsSectionTabsDefinition,
  query: string,
): PrefsSectionTabId | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const section = definition.prefsTab
  if (section !== 'appearance' && section !== 'export' && section !== 'editor') return null
  const schema = getSection(section)
  for (const tab of definition.tabs) {
    if (!tab.groupId) continue
    const group = schema.groups.find((entry) => entry.id === tab.groupId)
    if (!group) continue
    for (const path of group.items) {
      const item = getSetting(path)
      if (!item) continue
      if (settingLabelMatchesQuery(t, item.labelKey, item.descriptionKey, q)) return tab.id
    }
  }
  return null
}
