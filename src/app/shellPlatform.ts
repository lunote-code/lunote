import { isTauri } from '@tauri-apps/api/core'

/** The desktop side uniformly uses the in-app custom menu bar (no longer relying on the system’s native menu)*/
export function usesInAppMenuBar(): boolean {
  return isTauri()
}
