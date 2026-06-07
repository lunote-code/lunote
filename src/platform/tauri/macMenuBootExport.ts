/**
 * Build macOS startup menu manifest (consumed by scripts/generate_mac_menu_boot.mjs → Rust).
 */
import { APP_DISPLAY_NAME } from '../../app/workspace/constants'
import { buildAppMenuSchema } from '../../menu/commandManifest.build'
import { formatTyporaMenuTitle } from '../../menu/menu.display'
import { isLeaf, isSeparator, isSubmenu } from '../../menu/menu.builder'
import { toTauriAccelerator } from '../../menu/menu.shortcuts'
import type { MenuBarGroup, MenuLeaf, MenuNode } from '../../menu/menu.types'

export type MacMenuBootNode =
  | { kind: 'separator' }
  | { kind: 'submenu'; id: string; labelKey: string; semanticIcon?: string; children: MacMenuBootNode[] }
  | {
      kind: 'item'
      id: string
      action: string
      labelKey: string
      menuIcon?: string
      semanticIcon?: string
      tauriAccelerator?: string
    }
  | {
      kind: 'check'
      id: string
      action: string
      labelKey: string
      tauriAccelerator?: string
    }
  | { kind: 'recent-placeholder' }

export type MacMenuBootManifest = {
  version: 1
  productName: string
  bar: MacMenuBootNode[]
  appSubmenu: {
    about: { id: string; labelKey: string }
    preferences: { id: string; labelKey: string; tauriAccelerator?: string }
    hide: { id: string; labelKey: string; tauriAccelerator?: string }
    hideOthers: { id: string; labelKey: string; tauriAccelerator?: string }
    showAll: { id: string; labelKey: string }
    quit: { id: string; labelKey: string; tauriAccelerator?: string }
  }
  /** Flat labelKey → translated string per UI locale */
  labels: Record<string, Record<string, string>>
}

function leafToBootNode(leaf: MenuLeaf): MacMenuBootNode {
  if (leaf.id === 'view-fullscreen') {
    return {
      kind: 'check',
      id: leaf.id,
      action: leaf.action ?? leaf.id,
      labelKey: leaf.labelKey,
      tauriAccelerator: toTauriAccelerator(leaf.accelerator),
    }
  }
  if (leaf.id === 'file-recent-placeholder') {
    return { kind: 'recent-placeholder' }
  }
  return {
    kind: 'item',
    id: leaf.id,
    action: leaf.action ?? leaf.id,
    labelKey: leaf.labelKey,
    menuIcon: leaf.menuIcon,
    semanticIcon: leaf.semanticIcon,
    tauriAccelerator: toTauriAccelerator(leaf.accelerator),
  }
}

function nodesToBoot(nodes: readonly MenuNode[]): MacMenuBootNode[] {
  const out: MacMenuBootNode[] = []
  for (const node of nodes) {
    if (isSeparator(node)) {
      out.push({ kind: 'separator' })
      continue
    }
    if (isSubmenu(node)) {
      out.push({
        kind: 'submenu',
        id: node.id,
        labelKey: node.labelKey,
        semanticIcon: node.semanticIcon,
        children: nodesToBoot(node.children),
      })
      continue
    }
    if (isLeaf(node)) {
      out.push(leafToBootNode(node))
    }
  }
  return out
}

function barToBoot(groups: readonly MenuBarGroup[]): MacMenuBootNode[] {
  return groups.map((group) => ({
    kind: 'submenu' as const,
    id: group.id,
    labelKey: group.labelKey,
    children: nodesToBoot(group.children),
  }))
}

function collectBootAccelerators(nodes: readonly MacMenuBootNode[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  for (const node of nodes) {
    if (node.kind === 'item' || node.kind === 'check') {
      map.set(node.action, node.tauriAccelerator)
    } else if (node.kind === 'submenu') {
      for (const [action, accel] of collectBootAccelerators(node.children)) {
        map.set(action, accel)
      }
    }
  }
  return map
}

function walkMenuLeaves(nodes: readonly MenuNode[], visit: (leaf: MenuLeaf) => void): void {
  for (const node of nodes) {
    if (isLeaf(node)) {
      visit(node)
      continue
    }
    if (isSubmenu(node)) walkMenuLeaves(node.children, visit)
  }
}

/** Fail fast when mac-menu-boot.json would embed Win/Linux accelerators (CI runs on Linux). */
export function assertMacMenuBootUsesMacAccelerators(manifest: Pick<MacMenuBootManifest, 'bar'>): void {
  const bootAccels = collectBootAccelerators(manifest.bar)
  const macSchema = buildAppMenuSchema('mac')
  const mismatches: string[] = []

  for (const group of macSchema.bar) {
    walkMenuLeaves(group.children, (leaf) => {
      const action = leaf.action ?? leaf.id
      const expected = toTauriAccelerator(leaf.accelerator)
      const actual = bootAccels.get(action)
      if (expected !== actual) {
        mismatches.push(`${leaf.id}: expected ${expected ?? '(none)'}, got ${actual ?? '(none)'}`)
      }
    })
  }

  if (mismatches.length > 0) {
    throw new Error(
      `mac-menu-boot.json must use macOS accelerators (host platform must not affect generation):\n${mismatches.join('\n')}`,
    )
  }
}

export function collectMacMenuBootLabelKeys(manifest: Omit<MacMenuBootManifest, 'labels'>): Set<string> {
  const keys = new Set<string>()
  const walk = (nodes: MacMenuBootNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'submenu') {
        keys.add(node.labelKey)
        walk(node.children)
      } else if (node.kind === 'item' || node.kind === 'check') {
        keys.add(node.labelKey)
      }
    }
  }
  walk(manifest.bar)
  keys.add(manifest.appSubmenu.about.labelKey)
  keys.add(manifest.appSubmenu.preferences.labelKey)
  keys.add(manifest.appSubmenu.hide.labelKey)
  keys.add(manifest.appSubmenu.hideOthers.labelKey)
  keys.add(manifest.appSubmenu.showAll.labelKey)
  keys.add(manifest.appSubmenu.quit.labelKey)
  keys.add('menu.file.recent')
  keys.add('menu.file.clearRecent')
  keys.add('menu.native.recentEmpty')
  return keys
}

export function buildMacMenuBootManifest(
  localeMessages: Record<string, Record<string, string>>,
): MacMenuBootManifest {
  // Always resolve macOS accelerators — this manifest is consumed by Rust on Darwin only.
  const macMenuSchema = buildAppMenuSchema('mac')
  const skeleton: Omit<MacMenuBootManifest, 'labels'> = {
    version: 1,
    productName: APP_DISPLAY_NAME,
    bar: barToBoot(macMenuSchema.bar),
    appSubmenu: {
      about: { id: 'help-about', labelKey: 'menu.native.help.about' },
      preferences: {
        id: 'preferences',
        labelKey: 'menu.file.preferences',
        tauriAccelerator: toTauriAccelerator('Mod+,'),
      },
      hide: { id: 'app-hide', labelKey: 'menu.native.app.hide', tauriAccelerator: toTauriAccelerator('Mod+H') },
      hideOthers: {
        id: 'app-hide-others',
        labelKey: 'menu.native.app.hideOthers',
        tauriAccelerator: toTauriAccelerator('Mod+Alt+H'),
      },
      showAll: { id: 'app-show-all', labelKey: 'menu.native.app.showAll' },
      quit: { id: 'app-quit', labelKey: 'menu.native.app.quit', tauriAccelerator: toTauriAccelerator('Mod+Q') },
    },
  }

  const labelKeys = collectMacMenuBootLabelKeys(skeleton)
  const labels: Record<string, Record<string, string>> = {}
  for (const [locale, messages] of Object.entries(localeMessages)) {
    const map: Record<string, string> = {}
    for (const key of labelKeys) {
      const raw = messages[key]
      if (typeof raw === 'string' && raw.trim()) {
        map[key] = raw
      }
    }
    labels[locale] = map
  }

  return { ...skeleton, labels }
}

export function buildAndValidateMacMenuBootManifest(
  localeMessages: Record<string, Record<string, string>>,
): MacMenuBootManifest {
  const manifest = buildMacMenuBootManifest(localeMessages)
  assertMacMenuBootUsesMacAccelerators(manifest)
  return manifest
}

/** Resolve menu item title the same way as native JS menu builder (glyph prefix). */
export function resolveMacMenuBootItemText(
  labelKey: string,
  menuIcon: string | undefined,
  labels: Record<string, string>,
): string {
  const translated = labels[labelKey] ?? labelKey
  if (menuIcon) {
    return formatTyporaMenuTitle(translated, menuIcon)
  }
  return translated
}
