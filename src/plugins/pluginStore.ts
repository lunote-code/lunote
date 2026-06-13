import { PLUGINS_INSTALLED_STORAGE_KEY } from './pluginConstants'
import type { InstalledPluginRecord } from './pluginTypes'

function readStorage(): InstalledPluginRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PLUGINS_INSTALLED_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is InstalledPluginRecord =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as InstalledPluginRecord).id === 'string' &&
        typeof (entry as InstalledPluginRecord).version === 'string',
    )
  } catch {
    return []
  }
}

function writeStorage(records: InstalledPluginRecord[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PLUGINS_INSTALLED_STORAGE_KEY, JSON.stringify(records))
}

export function listInstalledPluginsFromStore(): InstalledPluginRecord[] {
  return readStorage()
}

export function isPluginInstalledInStore(pluginId: string): boolean {
  return readStorage().some((entry) => entry.id === pluginId)
}

export function upsertInstalledPluginInStore(record: InstalledPluginRecord): void {
  const next = readStorage().filter((entry) => entry.id !== record.id)
  next.push(record)
  next.sort((a, b) => a.name.localeCompare(b.name))
  writeStorage(next)
}

export function removeInstalledPluginFromStore(pluginId: string): void {
  const next = readStorage().filter((entry) => entry.id !== pluginId)
  writeStorage(next)
}
