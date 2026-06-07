import { getAppSettingsSnapshot } from '../settings/appSettingsStore'
import type { AppSettingsState } from '../settings/appSettingsTypes'
import { getManifestEntry } from './commandManifest.build'
import type { CommandManifestEntry, CommandRuntimeKind } from './commandManifest.types'
import { eventMatchesAccelerator, formatAcceleratorForDisplay, parseAccelerator } from './menu.shortcuts'
import {
  getManifestDefaultAccelerator,
  isShortcutCustomizable,
  MENU_CONFIGURABLE_SHORTCUT_IDS,
} from './shortcutPlatformDefaults'

const CUSTOMIZABLE_RUNTIMES = new Set<CommandRuntimeKind>([
  'menu',
  'noop',
  'app-save',
  'app-save-as',
  'app-close-tab',
  'app-preferences',
  'app-quit',
  'app-focus-mode',
  'app-mode-toggle',
])

export type ShortcutConflict = {
  commandId: string
  otherId: string
  accelerator: string
}

function listMenuShortcutEntries(): CommandManifestEntry[] {
  const out: CommandManifestEntry[] = []
  for (const id of MENU_CONFIGURABLE_SHORTCUT_IDS) {
    const entry = getManifestEntry(id)
    if (!entry) continue
    if (!CUSTOMIZABLE_RUNTIMES.has(entry.runtime)) continue
    if (entry.nativeAcceleratorExcluded) continue
    if (!getManifestDefaultAccelerator(id)) continue
    out.push(entry)
  }
  return out
}

/** Shortcut keys editable in preferences (consistent with product shortcut keys table)*/
export function listCustomizableShortcutCommands(): readonly CommandManifestEntry[] {
  return listMenuShortcutEntries().filter((entry) => isShortcutCustomizable(entry.id))
}

export { getManifestDefaultAccelerator }

export function getShortcutOverrides(
  settings: AppSettingsState = getAppSettingsSnapshot(),
): Readonly<Record<string, string>> {
  return settings.shortcutOverrides ?? {}
}

export function getEffectiveAccelerator(
  commandId: string,
  settings: AppSettingsState = getAppSettingsSnapshot(),
): string | undefined {
  if (!isShortcutCustomizable(commandId)) {
    return getManifestDefaultAccelerator(commandId)
  }
  const overrides = settings.shortcutOverrides ?? {}
  if (overrides[commandId]) return overrides[commandId]
  return getManifestDefaultAccelerator(commandId)
}

/** Display shortcut for UI hints (respects user overrides + platform Mod mapping). */
export function formatCommandShortcutDisplay(
  commandId: string,
  settings: AppSettingsState = getAppSettingsSnapshot(),
): string {
  const acc = getEffectiveAccelerator(commandId, settings) ?? getManifestDefaultAccelerator(commandId)
  return formatAcceleratorForDisplay(acc ?? '')
}

/** Merge the default and overridden binding lists for global shortcut key runtime matching*/
export function listBoundShortcutCommands(
  settings: AppSettingsState = getAppSettingsSnapshot(),
): CommandManifestEntry[] {
  return listMenuShortcutEntries().map((entry) => {
    const accelerator = getEffectiveAccelerator(entry.id, settings)
    if (!accelerator) return entry
    if (accelerator === getManifestDefaultAccelerator(entry.id)) return { ...entry, accelerator }
    return { ...entry, accelerator }
  })
}

export function findShortcutConflicts(
  overrides: Readonly<Record<string, string>>,
): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = []
  const byAccel = new Map<string, string>()
  for (const entry of listMenuShortcutEntries()) {
    const acc = getEffectiveAccelerator(entry.id, {
      ...getAppSettingsSnapshot(),
      shortcutOverrides: overrides,
    })
    if (!acc) continue
    const prev = byAccel.get(acc)
    if (prev && prev !== entry.id) {
      conflicts.push({ commandId: entry.id, otherId: prev, accelerator: acc })
    } else {
      byAccel.set(acc, entry.id)
    }
  }
  return conflicts
}

export function validateShortcutAccelerator(acc: string): string | null {
  const trimmed = acc.trim()
  if (!trimmed) return 'empty'
  try {
    parseAccelerator(trimmed)
    return null
  } catch {
    return 'invalid'
  }
}

/** Encodes keyboard events as accelerator; modifier key alone or Escape returns null*/
export function keyboardEventToAccelerator(event: KeyboardEvent): string | null {
  if (event.key === 'Escape') return null
  if (['Control', 'Meta', 'Shift', 'Alt', 'OS'].includes(event.key)) return null

  const keyPart = eventKeyToAccelKey(event)
  if (!keyPart) return null

  const parts: string[] = []
  const explicitCtrl = event.ctrlKey && event.metaKey

  if (explicitCtrl) {
    parts.push('Mod', 'Ctrl')
  } else if (event.metaKey) {
    parts.push('Mod')
  } else if (event.ctrlKey && !event.altKey) {
    parts.push('Ctrl')
  }

  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')

  if (parts.length === 0 && /^F\d{1,2}$/i.test(keyPart)) {
    return keyPart.toUpperCase()
  }
  if (parts.length === 0) return null

  parts.push(keyPart)
  return parts.join('+')
}

function eventKeyToAccelKey(event: KeyboardEvent): string | null {
  const key = event.key
  if (key === ',') return ','
  if (key === '.') return '.'
  if (key === '/') return '/'
  if (key === '\\') return '\\'
  if (key === '[') return '['
  if (key === ']') return ']'
  if (key === '=' || key === '+') return '='
  if (key === '-') return '-'
  if (key === '`') return '`'
  if (/^[0-9]$/.test(key)) return key
  if (key.length === 1) return key.toLowerCase()
  if (key === 'Enter') return 'Enter'
  if (key === 'Backspace') return 'Backspace'
  if (key === 'Delete') return 'Delete'
  if (key === 'Tab') return 'Tab'
  if (key === ' ') return 'Space'
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase()
  return null
}

export function registryCommandMatchesEventWithOverrides(
  commandId: string,
  event: KeyboardEvent,
  settings: AppSettingsState = getAppSettingsSnapshot(),
): boolean {
  const acc = getEffectiveAccelerator(commandId, settings)
  if (!acc) return false
  return eventMatchesAccelerator(event, acc)
}
