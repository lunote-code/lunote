import { invoke, isTauri } from '@tauri-apps/api/core'

import { scopedPathPayload } from '../../lib/tauriScopedInvoke'

export async function revealInExplorer(path: string, root: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Reveal in explorer is only available in Tauri runtime')
  }
  await invoke('reveal_in_explorer', scopedPathPayload(path, root))
}

export async function openTrustedPath(path: string, root: string): Promise<void> {
  await invoke('open_trusted_path', scopedPathPayload(path, root))
}

export async function syncRecentMenu(paths: string[]): Promise<void> {
  await invoke('sync_recent_menu', { paths })
}

export async function syncThemeCssMenu(names: string[]): Promise<void> {
  await invoke('sync_theme_css_menu', { payload: { names } })
}

export async function syncViewFullscreenMenuCheckedByHost(checked: boolean): Promise<void> {
  await invoke('sync_view_fullscreen_menu_checked', { checked })
}
