import { SETTINGS_SCHEMA } from './settingsSchema'
import type { GroupSetting, LeafSetting, SettingsItem, SettingsSectionId, SettingsSectionSchema } from './settingsTypes'

const itemsByPath = new Map<string, LeafSetting>()
const groupsBySection = new Map<SettingsSectionId, GroupSetting[]>()
const itemsBySection = new Map<SettingsSectionId, LeafSetting[]>()

function registerSetting(item: SettingsItem): void {
  if (item.type === 'group') {
    const groups = groupsBySection.get(item.section) ?? []
    groups.push(item)
    groupsBySection.set(item.section, groups)
    return
  }

  itemsByPath.set(item.path, item)
  const items = itemsBySection.get(item.section) ?? []
  items.push(item)
  itemsBySection.set(item.section, items)
}

for (const item of SETTINGS_SCHEMA) {
  registerSetting(item)
}

export function getSetting(path: string): LeafSetting | undefined {
  return itemsByPath.get(path)
}

export function getSection(section: SettingsSectionId): SettingsSectionSchema {
  return {
    section,
    groups: groupsBySection.get(section) ?? [],
    items: itemsBySection.get(section) ?? [],
  }
}

export function getFlatSettingsSchema(): readonly LeafSetting[] {
  return [...itemsByPath.values()]
}

export function getSettingsSchema(): readonly SettingsItem[] {
  return SETTINGS_SCHEMA
}
