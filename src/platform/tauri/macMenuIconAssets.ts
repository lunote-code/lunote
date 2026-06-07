import { Image } from '@tauri-apps/api/image'

import type { SemanticIconName } from '../../design-system/icons'
import { formatTyporaMenuTitle } from '../../menu/menu.display'
import type { MenuLeaf } from '../../menu/menu.types'

const iconCache = new Map<SemanticIconName, Image>()
const missingIcons = new Set<SemanticIconName>()

export async function loadMacMenuIcon(semantic: SemanticIconName): Promise<Image | null> {
  if (missingIcons.has(semantic)) return null
  const cached = iconCache.get(semantic)
  if (cached) return cached

  try {
    const res = await fetch(`/mac-menu-icons/${semantic}.png`)
    if (!res.ok) {
      missingIcons.add(semantic)
      return null
    }
    const bytes = await res.arrayBuffer()
    const image = await Image.fromBytes(bytes)
    iconCache.set(semantic, image)
    return image
  } catch {
    missingIcons.add(semantic)
    return null
  }
}

export function resolveMacMenuItemText(leaf: MenuLeaf, t: (key: string) => string): string {
  if (leaf.menuIcon) {
    return formatTyporaMenuTitle(t(leaf.labelKey), leaf.menuIcon)
  }
  return t(leaf.labelKey)
}

/** PNG icon when semanticIcon is set and no Typora glyph / color swatch overrides. */
export async function resolveMacMenuLeafIcon(leaf: MenuLeaf): Promise<Image | null> {
  if (leaf.menuIcon || leaf.menuColorSwatch || !leaf.semanticIcon) return null
  return loadMacMenuIcon(leaf.semanticIcon)
}

export async function resolveMacSubmenuIcon(
  semantic: SemanticIconName | undefined,
): Promise<Image | null> {
  if (!semantic) return null
  return loadMacMenuIcon(semantic)
}

/** App menu / About — line-art template PNG (see export_mac_menu_icons.mjs). */
export async function loadMacAppMarkIcon(): Promise<Image | null> {
  return loadMacMenuIcon('app-mark')
}
