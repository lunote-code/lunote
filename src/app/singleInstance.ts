import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'

import { raiseMainWindow } from '../platform/tauri/raiseMainWindow'

/** Focus the main window when the user launches a second instance. */
export async function installSingleInstanceHandler(): Promise<void> {
  if (!isTauri()) return
  await listen('single-instance', async () => {
    await raiseMainWindow()
  })
}
