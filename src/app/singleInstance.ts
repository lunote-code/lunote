import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

/** Focus the main window when the user launches a second instance. */
export async function installSingleInstanceHandler(): Promise<void> {
  if (!isTauri()) return
  await listen('single-instance', async () => {
    const win = getCurrentWindow()
    await win.unminimize().catch(() => undefined)
    await win.show().catch(() => undefined)
    await win.setFocus().catch(() => undefined)
  })
}
