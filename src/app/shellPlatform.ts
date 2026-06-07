import { isTauri } from '@tauri-apps/api/core'

import { isMacDesktopPlatform } from '../platform/desktopPlatform'

/** Win/Linux Tauri uses the in-app React menu bar; macOS uses the system menu bar. */
export function usesInAppMenuBar(): boolean {
  return isTauri() && !isMacDesktopPlatform()
}

/** macOS Tauri installs a native app menu via `@tauri-apps/api/menu`. */
export function usesNativeMacAppMenu(): boolean {
  return isTauri() && isMacDesktopPlatform()
}
