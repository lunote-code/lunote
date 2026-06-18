import { isTauri } from '@tauri-apps/api/core'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TrayIcon, type TrayIconEvent } from '@tauri-apps/api/tray'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'

import { getEffectiveAccelerator } from '../../menu/shortcutCustomization'
import { toGlobalShortcutAccelerator } from '../../menu/menu.shortcuts'
import { isMacDesktopPlatform } from '../desktopPlatform'
import { setCloseToTrayReady } from './platformShellService'
import { raiseMainWindow } from './raiseMainWindow'
import { applyTrayIcon, loadTrayIconForCreate } from './trayIcon'

export type QuickCaptureDeps = {
  t: (key: string) => string
  onOpenTodayDailyNote: () => void | Promise<void>
}

/** i18n keys for tray context menu labels (reuse native/file menu semantics). */
export const TRAY_MENU_LABEL_KEYS = {
  dailyNote: 'menu.file.dailyNote',
  showWindow: 'tray.menu.showWindow',
  quit: 'menu.native.app.quit',
} as const

const TRAY_ID = 'lunote-quick-capture'
const GLOBAL_SHORTCUT_COMMAND = 'daily-note-open'
const TRAY_STATE_KEY = '__lunoteQuickCaptureTrayState__'

type QuickCaptureTrayState = {
  tray: TrayIcon | null
  trayReady: boolean
  registeredShortcut: string | null
  deps: QuickCaptureDeps | null
  trayOp: Promise<void>
}

function trayState(): QuickCaptureTrayState {
  const host = globalThis as typeof globalThis & { [TRAY_STATE_KEY]?: QuickCaptureTrayState }
  if (!host[TRAY_STATE_KEY]) {
    host[TRAY_STATE_KEY] = {
      tray: null,
      trayReady: false,
      registeredShortcut: null,
      deps: null,
      trayOp: Promise.resolve(),
    }
  }
  return host[TRAY_STATE_KEY]
}

function queueTrayOp<T>(fn: () => Promise<T>): Promise<T> {
  const state = trayState()
  const run = state.trayOp.then(fn)
  state.trayOp = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function syncCloseToTrayRuntime(ready: boolean): Promise<void> {
  const state = trayState()
  state.trayReady = ready
  if (!isTauri()) return
  await setCloseToTrayReady(ready).catch(() => undefined)
}

export function isCloseToTrayAvailable(): boolean {
  // macOS keeps the app in the Dock after hide(); tray is optional for reopen.
  if (isMacDesktopPlatform()) return true
  return trayState().trayReady
}

async function buildTrayMenu(deps: QuickCaptureDeps): Promise<Menu> {
  return Menu.new({
    items: [
      await MenuItem.new({
        id: 'daily-note-open',
        text: deps.t(TRAY_MENU_LABEL_KEYS.dailyNote),
        accelerator: toGlobalShortcutAccelerator(
          getEffectiveAccelerator(GLOBAL_SHORTCUT_COMMAND) ?? 'Mod+Shift+d',
        ),
      }),
      await MenuItem.new({
        id: 'quick-capture-show',
        text: deps.t(TRAY_MENU_LABEL_KEYS.showWindow),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'app-quit',
        text: deps.t(TRAY_MENU_LABEL_KEYS.quit),
      }),
    ],
  })
}

function onTrayLeftClick(event: TrayIconEvent): void {
  if (event.type !== 'Click') return
  if (event.button !== 'Left' || event.buttonState !== 'Down') return
  const deps = trayState().deps
  if (!deps) return
  void (async () => {
    await raiseMainWindow()
    await deps.onOpenTodayDailyNote()
  })()
}

function onGlobalDailyNoteShortcut(): void {
  const deps = trayState().deps
  if (!deps) return
  void (async () => {
    await raiseMainWindow()
    await deps.onOpenTodayDailyNote()
  })()
}

/** Reattach after HMR or create a single native tray icon. */
async function ensureTrayInstance(deps: QuickCaptureDeps): Promise<TrayIcon> {
  const state = trayState()
  if (!state.tray) {
    state.tray = await TrayIcon.getById(TRAY_ID)
  }
  if (state.tray) return state.tray

  await TrayIcon.removeById(TRAY_ID).catch(() => undefined)

  state.tray = await TrayIcon.new({
    id: TRAY_ID,
    ...(await loadTrayIconForCreate()),
    tooltip: deps.t('tray.tooltip'),
    menu: await buildTrayMenu(deps),
    showMenuOnLeftClick: false,
    action: onTrayLeftClick,
  })
  return state.tray
}

async function installQuickCaptureInternal(deps: QuickCaptureDeps): Promise<void> {
  if (!isTauri()) return

  const state = trayState()
  state.deps = deps

  const accelerator =
    toGlobalShortcutAccelerator(
      getEffectiveAccelerator(GLOBAL_SHORTCUT_COMMAND) ?? 'Mod+Shift+d',
    ) ?? 'CommandOrControl+Shift+D'

  if (state.registeredShortcut && state.registeredShortcut !== accelerator) {
    await unregister(state.registeredShortcut).catch(() => undefined)
    state.registeredShortcut = null
  }

  if (!state.registeredShortcut) {
    try {
      await register(accelerator, (event) => {
        if (event.state !== 'Pressed') return
        onGlobalDailyNoteShortcut()
      })
      state.registeredShortcut = accelerator
    } catch (error) {
      console.warn('[quick-capture] global shortcut registration failed', { accelerator, error })
    }
  }

  const instance = await ensureTrayInstance(deps)
  await applyTrayIcon(instance)
  await instance.setMenu(await buildTrayMenu(deps))
  await instance.setTooltip(deps.t('tray.tooltip'))
  await syncCloseToTrayRuntime(true)
}

async function teardownQuickCaptureInternal(): Promise<void> {
  const state = trayState()
  state.deps = null
  if (state.registeredShortcut) {
    await unregister(state.registeredShortcut).catch(() => undefined)
    state.registeredShortcut = null
  }
  if (state.tray) {
    await state.tray.close().catch(() => undefined)
    state.tray = null
  }
  await TrayIcon.removeById(TRAY_ID).catch(() => undefined)
  await syncCloseToTrayRuntime(false)
}

export function installQuickCapture(deps: QuickCaptureDeps): Promise<void> {
  return queueTrayOp(async () => {
    try {
      await installQuickCaptureInternal(deps)
    } catch (error) {
      await syncCloseToTrayRuntime(false)
      throw error
    }
  })
}

/** Explicit shutdown only — not called on React StrictMode/HMR remounts. */
export function teardownQuickCapture(): Promise<void> {
  return queueTrayOp(() => teardownQuickCaptureInternal())
}
