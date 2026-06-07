import {
  CheckMenuItem,
  IconMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from '@tauri-apps/api/menu'

import { APP_DISPLAY_NAME } from '../../app/workspace/constants'
import { isValidRecentFilePath } from '../../lib/workspacePathUtils'
import {
  APP_MENU_SCHEMA,
  isLeaf,
  isSeparator,
  isSubmenu,
  toTauriAccelerator,
} from '../../menu'
import type { MenuLeaf, MenuNode } from '../../menu/menu.types'
import { invoke } from '@tauri-apps/api/core'

import {
  loadMacAppMarkIcon,
  resolveMacMenuItemText,
  resolveMacMenuLeafIcon,
  resolveMacSubmenuIcon,
} from './macMenuIconAssets'

export type MacNativeMenuDeps = {
  t: (key: string) => string
  recentFiles: readonly string[]
  fullscreenChecked: boolean
}

type NativeMenuItem = Submenu | MenuItem | IconMenuItem | PredefinedMenuItem | CheckMenuItem

let activeMacMenu: Menu | null = null

export function registerMacNativeAppMenu(menu: Menu | null): void {
  activeMacMenu = menu
}

export function getRegisteredMacNativeAppMenu(): Menu | null {
  return activeMacMenu
}

type MenuTextItem = { setText(text: string): Promise<void> }

async function setMenuItemText(menu: Menu, id: string, text: string): Promise<void> {
  const item = await menu.get(id)
  if (item && typeof (item as MenuTextItem).setText === 'function') {
    await (item as MenuTextItem).setText(text)
  }
}

async function patchMenuNodes(menu: Menu, nodes: readonly MenuNode[], deps: MacNativeMenuDeps): Promise<void> {
  for (const node of nodes) {
    if (isSeparator(node)) continue
    if (isSubmenu(node)) {
      await setMenuItemText(menu, node.id, deps.t(node.labelKey))
      await patchMenuNodes(menu, node.children, deps)
      continue
    }
    if (!isLeaf(node)) continue
    if (node.id === 'file-recent-placeholder') {
      await setMenuItemText(menu, 'sub-recent-dynamic', deps.t('menu.file.recent'))
      await setMenuItemText(menu, 'file-clear-recent', deps.t('menu.file.clearRecent'))
      await setMenuItemText(menu, 'recent-placeholder', deps.t('menu.native.recentEmpty'))
      continue
    }
    const actionId = node.action ?? node.id
    await setMenuItemText(menu, actionId, resolveMacMenuItemText(node, deps.t))
  }
}

/** Update menu labels in-place (no full rebuild) — used after locale changes. */
export async function patchMacNativeAppMenuLabels(menu: Menu, deps: MacNativeMenuDeps): Promise<void> {
  await setMenuItemText(menu, 'bar-app', APP_DISPLAY_NAME)
  await setMenuItemText(menu, 'help-about', deps.t('menu.native.help.about'))
  await setMenuItemText(menu, 'preferences', deps.t('menu.file.preferences'))
  await setMenuItemText(menu, 'app-hide', deps.t('menu.native.app.hide'))
  await setMenuItemText(menu, 'app-hide-others', deps.t('menu.native.app.hideOthers'))
  await setMenuItemText(menu, 'app-show-all', deps.t('menu.native.app.showAll'))
  await setMenuItemText(menu, 'app-quit', deps.t('menu.native.app.quit'))

  for (const group of APP_MENU_SCHEMA.bar) {
    await setMenuItemText(menu, group.id, deps.t(group.labelKey))
    await patchMenuNodes(menu, group.children, deps)
  }
}

const RECENT_MENU_LIMIT = 8

function basename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(i + 1) : norm
}

async function buildRecentSection(deps: MacNativeMenuDeps): Promise<NativeMenuItem[]> {
  const valid = deps.recentFiles.filter(isValidRecentFilePath).slice(0, RECENT_MENU_LIMIT)
  if (valid.length === 0) {
    return [
      await MenuItem.new({
        id: 'recent-placeholder',
        text: deps.t('menu.native.recentEmpty'),
        enabled: false,
      }),
    ]
  }

  const recentIcon = await resolveMacSubmenuIcon('sort-time')
  const noteIcon = await resolveMacSubmenuIcon('note')
  const clearIcon = await resolveMacSubmenuIcon('delete')

  const items: NativeMenuItem[] = []
  for (let i = 0; i < valid.length; i++) {
    if (noteIcon) {
      items.push(
        await IconMenuItem.new({
          id: `recent-${i}`,
          text: basename(valid[i]!),
          icon: noteIcon,
        }),
      )
    } else {
      items.push(
        await MenuItem.new({
          id: `recent-${i}`,
          text: basename(valid[i]!),
        }),
      )
    }
  }
  items.push(await PredefinedMenuItem.new({ item: 'Separator' }))
  if (clearIcon) {
    items.push(
      await IconMenuItem.new({
        id: 'file-clear-recent',
        text: deps.t('menu.file.clearRecent'),
        icon: clearIcon,
      }),
    )
  } else {
    items.push(
      await MenuItem.new({
        id: 'file-clear-recent',
        text: deps.t('menu.file.clearRecent'),
      }),
    )
  }

  const recentSubmenuOpts = {
    id: 'sub-recent-dynamic',
    text: deps.t('menu.file.recent'),
    items,
    ...(recentIcon ? { icon: recentIcon } : {}),
  }
  return [await Submenu.new(recentSubmenuOpts)]
}

async function buildLeafItem(leaf: MenuLeaf, deps: MacNativeMenuDeps): Promise<NativeMenuItem | null> {
  const text = resolveMacMenuItemText(leaf, deps.t)
  const actionId = leaf.action ?? leaf.id
  const accelerator = toTauriAccelerator(leaf.accelerator)

  if (leaf.id === 'view-fullscreen') {
    return CheckMenuItem.new({
      id: leaf.id,
      text,
      checked: deps.fullscreenChecked,
      accelerator,
    })
  }

  const icon = await resolveMacMenuLeafIcon(leaf)
  if (icon) {
    return IconMenuItem.new({
      id: actionId,
      text,
      icon,
      accelerator,
    })
  }

  return MenuItem.new({
    id: actionId,
    text,
    accelerator,
  })
}

async function buildMenuNodes(nodes: readonly MenuNode[], deps: MacNativeMenuDeps): Promise<NativeMenuItem[]> {
  const out: NativeMenuItem[] = []
  let lastWasSeparator = true

  const pushSeparator = async () => {
    if (lastWasSeparator) return
    out.push(await PredefinedMenuItem.new({ item: 'Separator' }))
    lastWasSeparator = true
  }

  for (const node of nodes) {
    if (isSeparator(node)) {
      await pushSeparator()
      continue
    }

    lastWasSeparator = false

    if (isSubmenu(node)) {
      const items = await buildMenuNodes(node.children, deps)
      if (items.length === 0) continue
      const icon = await resolveMacSubmenuIcon(node.semanticIcon)
      out.push(
        await Submenu.new({
          id: node.id,
          text: deps.t(node.labelKey),
          items,
          ...(icon ? { icon } : {}),
        }),
      )
      continue
    }

    if (!isLeaf(node)) continue

    if (node.id === 'file-recent-placeholder') {
      out.push(...(await buildRecentSection(deps)))
      continue
    }

    const item = await buildLeafItem(node, deps)
    if (item) out.push(item)
  }

  if (lastWasSeparator && out.length > 0) {
    out.pop()
  }

  return out
}

async function buildAppSubmenu(deps: MacNativeMenuDeps): Promise<Submenu> {
  const aboutIcon = await loadMacAppMarkIcon()
  const settingsIcon = await resolveMacSubmenuIcon('settings')

  const aboutItem = aboutIcon
    ? await IconMenuItem.new({
        id: 'help-about',
        text: deps.t('menu.native.help.about'),
        icon: aboutIcon,
      })
    : await MenuItem.new({
        id: 'help-about',
        text: deps.t('menu.native.help.about'),
      })

  const preferencesItem = settingsIcon
    ? await IconMenuItem.new({
        id: 'preferences',
        text: deps.t('menu.file.preferences'),
        icon: settingsIcon,
        accelerator: toTauriAccelerator('Mod+,'),
      })
    : await MenuItem.new({
        id: 'preferences',
        text: deps.t('menu.file.preferences'),
        accelerator: toTauriAccelerator('Mod+,'),
      })

  return Submenu.new({
    id: 'bar-app',
    text: APP_DISPLAY_NAME,
    items: [
      aboutItem,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      preferencesItem,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Services' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'app-hide',
        text: deps.t('menu.native.app.hide'),
        accelerator: toTauriAccelerator('Mod+H'),
      }),
      await MenuItem.new({
        id: 'app-hide-others',
        text: deps.t('menu.native.app.hideOthers'),
        accelerator: toTauriAccelerator('Mod+Alt+H'),
      }),
      await MenuItem.new({
        id: 'app-show-all',
        text: deps.t('menu.native.app.showAll'),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'app-quit',
        text: deps.t('menu.native.app.quit'),
        accelerator: toTauriAccelerator('Mod+Q'),
      }),
    ],
  })
}

async function buildBarGroup(
  group: (typeof APP_MENU_SCHEMA.bar)[number],
  deps: MacNativeMenuDeps,
): Promise<Submenu | null> {
  const items = await buildMenuNodes(group.children, deps)
  if (items.length === 0) return null

  const submenu = await Submenu.new({
    id: group.id,
    text: deps.t(group.labelKey),
    items,
  })

  if (group.id === 'bar-window') {
    await submenu.setAsWindowsMenuForNSApp()
  }
  if (group.id === 'bar-help') {
    await submenu.setAsHelpMenuForNSApp()
  }

  return submenu
}

export async function installMacNativeAppMenu(deps: MacNativeMenuDeps): Promise<Menu> {
  const appSub = await buildAppSubmenu(deps)
  const groups: Submenu[] = []

  for (const group of APP_MENU_SCHEMA.bar) {
    const built = await buildBarGroup(group, deps)
    if (built) groups.push(built)
  }

  const menu = await Menu.new({ items: [appSub, ...groups] })
  await menu.setAsAppMenu()
  await invoke('sync_mac_native_menu_icon_templates').catch(() => {
    /* non-macOS / invoke unavailable */
  })
  registerMacNativeAppMenu(menu)
  return menu
}

export async function syncMacNativeFullscreenMenu(checked: boolean): Promise<void> {
  await syncMacNativeFullscreenChecked(activeMacMenu, checked)
}

export async function syncMacNativeFullscreenChecked(
  menu: Menu | null,
  checked: boolean,
): Promise<void> {
  if (!menu) return
  const item = await menu.get('view-fullscreen')
  if (!item || !('setChecked' in item)) return
  await (item as CheckMenuItem).setChecked(checked)
}
