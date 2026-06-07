import { resolveResource } from '@tauri-apps/api/path'
import type { TrayIcon } from '@tauri-apps/api/tray'

import { getDesktopPlatform, type DesktopPlatform } from '../desktopPlatform'

/**
 * macOS menu bar uses ONE template PNG (black glyph, transparent background).
 * `iconAsTemplate: true` lets the system tint it for light/dark menu bars automatically.
 * No separate day/night assets are required.
 */
export const MACOS_TRAY_TEMPLATE_LOGICAL_PT = 18
export const MACOS_TRAY_TEMPLATE_PIXEL_SIZE = 36

/** Bundled tray icon paths (see `scripts/build/generate_app_icons.py`). */
export const TRAY_ICON_RESOURCES = {
  /** 36×36 px (@2x for 18pt menu bar slot). */
  macTemplate: 'icons/trayTemplate.png',
  colored: 'icons/32x32.png',
} as const

export type TrayIconSpec = {
  resourcePath: string
  iconAsTemplate: boolean
}

export function resolveTrayIconSpec(platform: DesktopPlatform = getDesktopPlatform()): TrayIconSpec {
  if (platform === 'mac') {
    return { resourcePath: TRAY_ICON_RESOURCES.macTemplate, iconAsTemplate: true }
  }
  return { resourcePath: TRAY_ICON_RESOURCES.colored, iconAsTemplate: false }
}

async function loadTrayIconResource(resourcePath: string): Promise<string | Uint8Array> {
  try {
    return await resolveResource(resourcePath)
  } catch {
    return resourcePath
  }
}

/** Apply platform-appropriate tray icon (macOS uses NSImage template rendering). */
export async function applyTrayIcon(instance: TrayIcon, spec: TrayIconSpec = resolveTrayIconSpec()): Promise<void> {
  const icon = await loadTrayIconResource(spec.resourcePath)
  if (spec.iconAsTemplate) {
    await instance.setIconWithAsTemplate(icon, true)
    return
  }
  await instance.setIcon(icon)
}

export async function loadTrayIconForCreate(spec: TrayIconSpec = resolveTrayIconSpec()): Promise<{
  icon: string | Uint8Array
  iconAsTemplate?: boolean
}> {
  const icon = await loadTrayIconResource(spec.resourcePath)
  return spec.iconAsTemplate ? { icon, iconAsTemplate: true } : { icon }
}
