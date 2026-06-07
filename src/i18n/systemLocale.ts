import { isTauri } from '@tauri-apps/api/core'
import { locale as readOsLocale } from '@tauri-apps/plugin-os'

let cachedOsLocale: string | null | undefined

/** Read the OS locale tag once (Tauri). Returns `null` when unavailable. */
export async function readTauriOsLocaleTag(): Promise<string | null> {
  if (!isTauri()) return null
  if (cachedOsLocale !== undefined) return cachedOsLocale
  try {
    cachedOsLocale = (await readOsLocale()) ?? null
  } catch {
    cachedOsLocale = null
  }
  return cachedOsLocale
}

export function getCachedTauriOsLocaleTag(): string | null | undefined {
  return cachedOsLocale
}

export function primeTauriOsLocaleTag(tag: string | null): void {
  cachedOsLocale = tag
}
