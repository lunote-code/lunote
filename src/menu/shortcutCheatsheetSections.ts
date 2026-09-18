import type { TranslateFn } from '../i18n'
import type { AppSettingsState } from '../settings/appSettingsTypes'
import { formatAcceleratorForDisplay } from './menu.shortcuts'
import { getEffectiveAccelerator } from './shortcutCustomization'
import { getManifestEntry } from './commandManifest.build'
import { SHORTCUT_PREF_SECTIONS } from './shortcutPlatformDefaults'

export type ShortcutCheatsheetRow = {
  commandId: string
  label: string
  shortcut: string
}

export type ShortcutCheatsheetSection = {
  id: string
  title: string
  rows: ShortcutCheatsheetRow[]
}

export function buildShortcutCheatsheetSections(
  t: TranslateFn,
  settings: AppSettingsState,
): ShortcutCheatsheetSection[] {
  return SHORTCUT_PREF_SECTIONS.map((section) => ({
    id: section.id,
    title: t(section.labelKey),
    rows: section.commandIds.flatMap((id) => {
      const entry = getManifestEntry(id)
      if (!entry) return []
      const effective = getEffectiveAccelerator(id, settings)
      return [
        {
          commandId: id,
          label: t(entry.labelKey),
          shortcut: effective ? formatAcceleratorForDisplay(effective) : '—',
        },
      ]
    }),
  })).filter((section) => section.rows.length > 0)
}
