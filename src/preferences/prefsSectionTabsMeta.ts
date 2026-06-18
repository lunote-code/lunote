import type { PrefsTabId } from './types'

export type PrefsSectionTabId = string

export type PrefsSectionTabDefinition = {
  id: PrefsSectionTabId
  groupId?: string
  labelKey: string
}

export type PrefsSectionTabsDefinition = {
  prefsTab: PrefsTabId
  storageKey: string
  tabsAriaLabelKey: string
  defaultTabId: PrefsSectionTabId
  tabs: readonly PrefsSectionTabDefinition[]
}

export const APPEARANCE_SECTION_TABS: PrefsSectionTabsDefinition = {
  prefsTab: 'appearance',
  storageKey: 'luna.prefs.appearanceSectionTab',
  tabsAriaLabelKey: 'prefs.appearance.tabs.label',
  defaultTabId: 'builtin',
  tabs: [
    { id: 'builtin', groupId: 'appearance.builtin', labelKey: 'settings.theme.builtin.title' },
    { id: 'externalCss', groupId: 'appearance.externalCss', labelKey: 'settings.theme.importCss.tabTitle' },
    { id: 'snippets', groupId: 'appearance.snippets', labelKey: 'settings.theme.importSnippets.tabTitle' },
  ],
}

export const EXPORT_SECTION_TABS: PrefsSectionTabsDefinition = {
  prefsTab: 'export',
  storageKey: 'luna.prefs.exportSectionTab',
  tabsAriaLabelKey: 'prefs.export.tabs.label',
  defaultTabId: 'general',
  tabs: [
    { id: 'general', groupId: 'export.general', labelKey: 'settings.export.tabTitle' },
    { id: 'styles', groupId: 'export.styles', labelKey: 'settings.theme.importExportStyles.tabTitle' },
  ],
}

export const EDITOR_SECTION_TABS: PrefsSectionTabsDefinition = {
  prefsTab: 'editor',
  storageKey: 'luna.prefs.editorSectionTab',
  tabsAriaLabelKey: 'prefs.editor.tabs.label',
  defaultTabId: 'typography',
  tabs: [
    { id: 'typography', groupId: 'editor.typography', labelKey: 'settings.editor.groups.typography.title' },
    { id: 'autosave', groupId: 'editor.autosave', labelKey: 'settings.editor.groups.autosave.title' },
  ],
}

export const TEMPLATES_SECTION_TABS: PrefsSectionTabsDefinition = {
  prefsTab: 'templates',
  storageKey: 'luna.prefs.templatesSectionTab',
  tabsAriaLabelKey: 'prefs.templates.tabs.label',
  defaultTabId: 'daily',
  tabs: [
    { id: 'daily', labelKey: 'settings.workspaceNotes.dailySectionTitle' },
    { id: 'newNote', labelKey: 'settings.workspaceNotes.templatesSectionTitle' },
  ],
}

export const THEME_FILE_FILTER_TABS: PrefsSectionTabsDefinition = {
  prefsTab: 'appearance',
  storageKey: 'luna.prefs.themeFileFilterTab',
  tabsAriaLabelKey: 'settings.theme.fileList.filterLabel',
  defaultTabId: 'all',
  tabs: [
    { id: 'all', labelKey: 'settings.theme.fileList.filterAll' },
    { id: 'enabled', labelKey: 'settings.theme.fileList.filterEnabled' },
  ],
}

const TABBED_SCHEMA_SECTIONS: Partial<Record<PrefsTabId, PrefsSectionTabsDefinition>> = {
  appearance: APPEARANCE_SECTION_TABS,
  export: EXPORT_SECTION_TABS,
  editor: EDITOR_SECTION_TABS,
}

export function getPrefsSectionTabsDefinition(prefsTab: PrefsTabId): PrefsSectionTabsDefinition | undefined {
  return TABBED_SCHEMA_SECTIONS[prefsTab]
}

export function readStoredPrefsSectionTab(definition: PrefsSectionTabsDefinition): PrefsSectionTabId {
  const validIds = definition.tabs.map((tab) => tab.id)
  try {
    const raw = localStorage.getItem(definition.storageKey)
    if (raw && validIds.includes(raw)) return raw
  } catch {
    /* ignore */
  }
  return definition.defaultTabId
}

export function writeStoredPrefsSectionTab(
  definition: PrefsSectionTabsDefinition,
  tabId: PrefsSectionTabId,
): void {
  try {
    localStorage.setItem(definition.storageKey, tabId)
  } catch {
    /* ignore */
  }
}

export function groupIdForPrefsSectionTab(
  definition: PrefsSectionTabsDefinition,
  tabId: PrefsSectionTabId,
): string | undefined {
  return definition.tabs.find((tab) => tab.id === tabId)?.groupId
}
