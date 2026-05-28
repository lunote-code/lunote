import type { AppMenuContext, AppMenuUiDeps } from './menu.types'

type AppActionHandler = (m: AppMenuContext, ui: AppMenuUiDeps) => Promise<boolean>

const VIEW_APP_ACTIONS: Record<string, AppActionHandler> = {
  'edit-find': async (m) => {
    m.openFindPanel()
    return true
  },
  'toggle-source-mode': async (m) => {
    m.toggleMainPaneMode()
    return true
  },
  'toggle-sidebar': async (_m, ui) => {
    ui.setSidebarVisible((v) => !v)
    return true
  },
  'toggle-focus': async (_m, ui) => {
    ui.setFocusMode((v) => !v)
    return true
  },
  'view-live-preview': async (_m, ui) => {
    ui.pendingSourceModeAnchorRef.current = null
    ui.resetModeSwitchEditorBootstrap()
    ui.setMainPaneMode('visual')
    ui.setFocusMode(true)
    return true
  },
  'toggle-sidebar-outline': async (_m, ui) => {
    const current = ui.getSidebarState()
    if (current.visible && current.mode === 'outline') {
      ui.setSidebarVisible(false)
    } else {
      ui.setSidebarListMode('outline')
      ui.setSidebarVisible(true)
    }
    return true
  },
  'view-sidebar-outline': async (_m, ui) => {
    const current = ui.getSidebarState()
    if (current.visible && current.mode === 'outline') {
      ui.setSidebarVisible(false)
    } else {
      ui.setSidebarListMode('outline')
      ui.setSidebarVisible(true)
    }
    return true
  },
  'toggle-sidebar-files': async (_m, ui) => {
    const current = ui.getSidebarState()
    if (current.visible && current.mode === 'files') {
      ui.setSidebarVisible(false)
    } else {
      ui.setSidebarListMode('files')
      ui.setSidebarVisible(true)
    }
    return true
  },
  'view-sidebar-files': async (_m, ui) => {
    const current = ui.getSidebarState()
    if (current.visible && current.mode === 'files') {
      ui.setSidebarVisible(false)
    } else {
      ui.setSidebarListMode('files')
      ui.setSidebarVisible(true)
    }
    return true
  },
  'view-search': async (_m, ui) => {
    ui.openGlobalSearchModal()
    return true
  },
}

export async function tryDispatchViewAppAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
): Promise<boolean> {
  const handler = VIEW_APP_ACTIONS[action]
  if (!handler) return false
  return handler(m, ui)
}
