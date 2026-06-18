import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Bring the main window to the foreground (tray / global shortcut quick capture). */
export async function raiseMainWindow(): Promise<void> {
  if (!isTauri()) return
  const win = (await WebviewWindow.getByLabel('main')) ?? getCurrentWindow()
  await win.unminimize().catch(() => undefined)
  await win.show().catch(() => undefined)
  await win.setFocus().catch(() => undefined)
}
