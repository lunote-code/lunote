import { collapseSeparators } from './menu.builder'
import { COMMAND_MANIFEST } from './commandManifest.entries'
import { MENU_BAR_STRUCTURE } from './commandManifest.structure'
import type { CommandManifestEntry } from './commandManifest.types'
import type { MenuBarGroup, MenuLeaf, MenuNode, MenuPathSegment, MenuSchemaRoot } from './menu.types'
import { resolveMenuCommandSemanticIcon, resolveMenuSubmenuSemanticIcon } from './menuSemanticIcons'
import { resolveMenuTextColorSwatch } from './menuTextColorSwatch'
import { getManifestDefaultAccelerator } from './shortcutPlatformDefaults'

export function getManifestEntry(id: string): CommandManifestEntry | undefined {
  return COMMAND_MANIFEST[id]
}

export function getManifestEntryOrThrow(id: string): CommandManifestEntry {
  const entry = COMMAND_MANIFEST[id]
  if (!entry) throw new Error(`[commandManifest] unknown command id: ${id}`)
  return entry
}

/** Generate menu leaves from manifest (prohibit external input of label/accelerator/icon)*/
export function manifestToMenuLeaf(id: string): MenuLeaf {
  const m = getManifestEntryOrThrow(id)
  const menuColorSwatch = resolveMenuTextColorSwatch(id)
  return {
    kind: 'item',
    id: m.id,
    labelKey: m.labelKey,
    accelerator: getManifestDefaultAccelerator(m.id) ?? m.accelerator,
    menuIcon: m.icon,
    semanticIcon: menuColorSwatch ? undefined : resolveMenuCommandSemanticIcon(id),
    menuColorSwatch,
    action: m.action ?? m.id,
    palette: m.ui.palette,
    paletteKeywords: m.ui.paletteKeywords,
    paletteHint: m.ui.paletteHint,
  }
}

function treeToMenuNodes(nodes: typeof MENU_BAR_STRUCTURE[0]['children']): MenuNode[] {
  const out: MenuNode[] = []
  for (const n of nodes) {
    if (n.kind === 'separator') {
      out.push({ kind: 'separator' })
      continue
    }
    if (n.kind === 'command') {
      out.push(manifestToMenuLeaf(n.id))
      continue
    }
    out.push({
      kind: 'submenu',
      id: n.id,
      labelKey: n.labelKey,
      semanticIcon: resolveMenuSubmenuSemanticIcon(n.id),
      children: collapseSeparators(treeToMenuNodes(n.children), { trimEnds: false }),
    })
  }
  return out
}

/** Generate APP_MENU_SCHEMA from manifest + structure tree*/
export function buildAppMenuSchema(): MenuSchemaRoot {
  const bar: MenuBarGroup[] = MENU_BAR_STRUCTURE.map((group) => ({
    kind: 'submenu' as const,
    id: group.id,
    labelKey: group.labelKey,
    children: collapseSeparators(treeToMenuNodes(group.children), { trimEnds: false }),
  }))
  return {
    version: 1,
    bar: collapseSeparators(bar, { trimEnds: true }) as MenuBarGroup[],
  }
}

export function listManifestWithAccelerator(): CommandManifestEntry[] {
  return Object.values(COMMAND_MANIFEST).filter((c) => Boolean(c.accelerator))
}

export function findMenuPathForCommand(commandId: string): MenuPathSegment[] {
  const path: MenuPathSegment[] = []

  function walk(nodes: typeof MENU_BAR_STRUCTURE[0]['children'], trail: MenuPathSegment[]): boolean {
    for (const n of nodes) {
      if (n.kind === 'separator') continue
      if (n.kind === 'command') {
        if (n.id === commandId) {
          path.push(...trail)
          return true
        }
        continue
      }
      const next = [...trail, { id: n.id, labelKey: n.labelKey }]
      if (walk(n.children, next)) return true
    }
    return false
  }

  for (const group of MENU_BAR_STRUCTURE) {
    const base: MenuPathSegment[] = [{ id: group.id, labelKey: group.labelKey }]
    if (walk(group.children, base)) return path
  }
  return path
}

export function eachManifestPaletteCommand(
  visit: (entry: CommandManifestEntry, menuPath: MenuPathSegment[]) => void,
): void {
  const seen = new Set<string>()
  for (const entry of Object.values(COMMAND_MANIFEST)) {
    if (!entry.ui.palette) continue
    const action = entry.action ?? entry.id
    if (seen.has(action)) continue
    seen.add(action)
    visit(entry, findMenuPathForCommand(entry.id))
  }
}
