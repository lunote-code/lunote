import { eachManifestPaletteCommand, getManifestEntry } from './commandManifest.build'
import { COMMAND_MANIFEST } from './commandManifest.entries'
import type { CommandManifestEntry } from './commandManifest.types'
import { formatTyporaMenuTitle, formatTyporaPaletteHint, formatTyporaPaletteLabel } from './menu.display'
import { formatAcceleratorForDisplay } from './menu.shortcuts'
import { getManifestDefaultAccelerator } from './shortcutPlatformDefaults'
import { TOOLBAR_DROPDOWN_CHILDREN, TOOLBAR_LAYOUT } from './commandManifest.structure'
import type {
  MenuPathSegment,
  PaletteCommandDef,
  ToolbarCommandDef,
  ToolbarItemDef,
} from './menu.types'

export type ManifestTranslate = (labelKey: string) => string | null

function resolveCommandView(
  entry: CommandManifestEntry,
  translate: ManifestTranslate,
  menuPath: MenuPathSegment[],
): { label: string; hint: string; shortcut?: string; keywords: string[] } | null {
  const label = translate(entry.labelKey)
  if (!label) return null

  const trail = menuPath.map((p) => translate(p.labelKey)).filter((s): s is string => Boolean(s))
  const breadcrumb = trail.join(' › ')
  const paletteHint = entry.ui.paletteHint ? translate(entry.ui.paletteHint) ?? undefined : undefined
  const hint = formatTyporaPaletteHint({
    breadcrumb,
    paletteHint,
  })
  const shortcut =
    formatAcceleratorForDisplay(getManifestDefaultAccelerator(entry.id) ?? entry.accelerator) || undefined
  const keywords = [
    ...(entry.ui.paletteKeywords ?? []),
    entry.id,
    entry.action ?? entry.id,
    ...menuPath.map((p) => p.id),
    ...trail,
  ]
  return {
    label: formatTyporaPaletteLabel(label, { menuIcon: entry.icon }),
    hint,
    shortcut,
    keywords,
  }
}

/** Command Palette: fully powered by manifest.ui.palette*/
export function compilePaletteFromManifest(translate: ManifestTranslate): PaletteCommandDef[] {
  const out: PaletteCommandDef[] = []
  eachManifestPaletteCommand((entry, menuPath) => {
    const resolved = resolveCommandView(entry, translate, menuPath)
    if (!resolved) return
    out.push({
      id: entry.id,
      label: resolved.label,
      hint: resolved.hint,
      shortcut: resolved.shortcut,
      keywords: resolved.keywords,
    })
  })
  return out
}

function compileToolbarCommandDef(
  entry: CommandManifestEntry,
  translate: ManifestTranslate,
): ToolbarCommandDef | null {
  const label = translate(entry.labelKey)
  if (!label) return null
  return {
    id: entry.id,
    label: formatTyporaMenuTitle(label, entry.icon),
    icon: entry.icon,
    shortcut: formatAcceleratorForDisplay(entry.accelerator) || undefined,
    title: formatTyporaMenuTitle(label, entry.icon),
  }
}

/** Toolbar: driven by manifest.ui.toolbar + TOOLBAR_LAYOUT (+ TOOLBAR_DROPDOWN_CHILDREN)*/
export function compileToolbarFromManifest(
  slot: keyof typeof TOOLBAR_LAYOUT,
  translate: ManifestTranslate,
): ToolbarItemDef[] {
  const ids = TOOLBAR_LAYOUT[slot]
  const out: ToolbarItemDef[] = []
  for (const id of ids) {
    const dropdownChildren = TOOLBAR_DROPDOWN_CHILDREN[id]
    if (dropdownChildren) {
      const entry = getManifestEntry(id)
      if (!entry?.ui.toolbar) continue
      const label = translate(entry.labelKey)
      if (!label) continue
      const items: ToolbarCommandDef[] = []
      for (const childId of dropdownChildren) {
        const childEntry = getManifestEntry(childId)
        if (!childEntry) continue
        const childDef = compileToolbarCommandDef(childEntry, translate)
        if (childDef) items.push(childDef)
      }
      if (!items.length) continue
      const title = formatTyporaMenuTitle(label, entry.icon)
      out.push({
        kind: 'dropdown',
        id: entry.id,
        label: title,
        title,
        items,
      })
      continue
    }

    const entry = getManifestEntry(id)
    if (!entry?.ui.toolbar) continue
    const def = compileToolbarCommandDef(entry, translate)
    if (!def) continue
    out.push({ kind: 'button', ...def })
  }
  return out
}

/** List manifest commands by group (palette group title, etc.)*/
export function listManifestByGroup(group: CommandManifestEntry['group']): CommandManifestEntry[] {
  return Object.values(COMMAND_MANIFEST).filter((e) => e.group === group)
}
