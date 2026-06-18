import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Bring the main window to the foreground (tray / global shortcut quick capture). */
export async function raiseMainWindow(): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('raise_main_window')
    return
  } catch {
    /* fall through to webview window API */
  }
  const win = (await WebviewWindow.getByLabel('main')) ?? getCurrentWindow()
  await win.unminimize().catch(() => undefined)
  await win.show().catch(() => undefined)
  await win.setFocus().catch(() => undefined)
}
