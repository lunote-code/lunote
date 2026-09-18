import type { AppMenuContext, AppMenuUiDeps } from './menu.types'
import { requestOpenAiPanel } from '../editor/ai/aiPanelStore'
import { requestEditorAiSelectionAction } from '../editor/ai/editorAiActions'

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
  'view-search': async (m, ui) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    ui.openGlobalSearchModal()
    return true
  },
  'view-knowledge-search': async (m, ui) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    ui.openKnowledgeSearchModal?.()
    return true
  },
  'view-quick-switcher': async (m, ui) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    ui.openQuickSwitcherModal()
    return true
  },
  'view-tab-switcher': async (_m, ui) => {
    ui.openTabSwitcherModal?.()
    return true
  },
  'view-ai-panel': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    requestOpenAiPanel()
    return true
  },
  'view-ai-ask-selection': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    if (m.getEditorContext().selectionEmpty) {
      m.setStatus(m.t('ai.rail.command.noSelection'))
      return true
    }
    requestEditorAiSelectionAction('ask-selection', m.t)
    return true
  },
  'view-ai-edit-selection': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    if (m.getEditorContext().selectionEmpty) {
      m.setStatus(m.t('ai.rail.command.noSelection'))
      return true
    }
    requestEditorAiSelectionAction('edit-selection', m.t)
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
