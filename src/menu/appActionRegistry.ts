import { open } from '@tauri-apps/plugin-dialog'

import { APP_DISPLAY_NAME } from '../app/workspace/constants'
import type { AppMenuContext, AppMenuUiDeps } from './menu.types'
import { isPathUnderWorkspace } from '../lib/workspacePathUtils'
import {
  openWorkspaceTemplateDocument,
  revealWorkspaceTemplatesFolder,
} from '../templates/templateService'
import type { OpenDailyNoteOutcome } from '../templates/dailyNoteService'

type AppActionHandler = (
  m: AppMenuContext,
  ui: AppMenuUiDeps,
  themeCssName?: string,
) => Promise<boolean>

function applyDailyNoteOpenStatus(
  m: AppMenuContext,
  outcome: OpenDailyNoteOutcome,
  openedMessageKey:
    | 'app.menu.dailyNoteOpened'
    | 'app.menu.dailyNoteYesterdayOpened'
    | 'app.menu.dailyNoteTomorrowOpened',
): void {
  if (outcome === 'no-workspace') {
    m.setStatus(m.t('app.menu.openWorkspaceFirst'))
    return
  }
  if (outcome === 'disabled') {
    m.setStatus(m.t('app.menu.dailyNoteDisabled'))
    return
  }
  m.setStatus(m.t(openedMessageKey))
}

async function openNewWindow(m: AppMenuContext): Promise<void> {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const label = `w${Date.now()}`
    const url = import.meta.env.DEV ? `${window.location.origin}/` : '/'
    const w = new WebviewWindow(label, {
      title: APP_DISPLAY_NAME,
      width: 1200,
      height: 800,
      url,
    })
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Create window timed out')), 15000)
      w.once('tauri://created', () => {
        window.clearTimeout(t)
        resolve()
      })
      w.once('tauri://error', (ev) => {
        window.clearTimeout(t)
        reject(new Error(typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)))
      })
    })
    m.setStatus(m.t('app.menu.newWindowOpened'))
  } catch (e) {
    m.setStatus(m.t('app.menu.newWindowFailed', { message: e instanceof Error ? e.message : String(e) }))
  }
}

const CORE_APP_ACTIONS: Record<string, AppActionHandler> = {
  'command-palette-open': async (_m, ui) => {
    ui.setCommandPaletteOpen(true)
    ui.setCommandPaletteQuery('')
    ui.setCommandPaletteIndex(0)
    return true
  },
  preferences: async (_m, ui) => {
    if (import.meta.env.DEV) {
      console.debug('[preferences][open]', { source: 'appActionRegistry' })
    }
    ui.openPreferencesDialog()
    return true
  },
  'file-new': async (m) => {
    if (!m.rootDir) {
      await m.scratchNewDocument()
      return true
    }
    m.openNewNoteDialog(m.rootDir, m.rootDir)
    return true
  },
  'file-new-from-template': async (m) => {
    if (!m.rootDir) {
      await m.scratchNewDocument()
      return true
    }
    m.openNewNoteFromTemplateDialog(m.rootDir, m.rootDir)
    return true
  },
  'file-new-tab': async (m) => {
    if (!m.rootDir) {
      await m.scratchNewTab()
      return true
    }
    m.openNewNoteDialog(m.rootDir, m.rootDir, true)
    return true
  },
  'file-new-window': async (m) => {
    await openNewWindow(m)
    return true
  },
  'daily-note-open': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      const outcome = await m.openDailyNote(0)
      applyDailyNoteOpenStatus(m, outcome, 'app.menu.dailyNoteOpened')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.dailyNoteFailed', { message: msg }))
    }
    return true
  },
  'daily-note-open-yesterday': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      const outcome = await m.openDailyNote(-1)
      applyDailyNoteOpenStatus(m, outcome, 'app.menu.dailyNoteYesterdayOpened')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.dailyNoteFailed', { message: msg }))
    }
    return true
  },
  'daily-note-open-tomorrow': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      const outcome = await m.openDailyNote(1)
      applyDailyNoteOpenStatus(m, outcome, 'app.menu.dailyNoteTomorrowOpened')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.dailyNoteFailed', { message: msg }))
    }
    return true
  },
  'template-edit-default': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      await openWorkspaceTemplateDocument(m.rootDir, 'defaultNewNote')
      m.setStatus(m.t('app.menu.templateDefaultOpened'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.templateOpenFailed', { message: msg }))
    }
    return true
  },
  'template-edit-daily': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      await openWorkspaceTemplateDocument(m.rootDir, 'dailyNote')
      m.setStatus(m.t('app.menu.templateDailyOpened'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.templateOpenFailed', { message: msg }))
    }
    return true
  },
  'template-open-folder': async (m) => {
    if (!m.rootDir?.trim()) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    try {
      await revealWorkspaceTemplatesFolder(m.rootDir)
      m.setStatus(m.t('app.menu.templateFolderOpened'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      m.setStatus(m.t('app.menu.templateOpenFailed', { message: msg }))
    }
    return true
  },
  'template-preferences': async (_m, ui) => {
    ui.openPreferencesDialog('templates')
    return true
  },
  'help-shortcuts': async (_m, ui) => {
    ui.openPreferencesDialog('shortcuts')
    return true
  },
  'file-open-file': async (m) => {
    if (!m.rootDir) {
      m.setStatus(m.t('app.menu.openWorkspaceFirst'))
      return true
    }
    const sel = await open({
      title: m.t('app.dialog.openMd'),
      defaultPath: m.rootDir,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      multiple: false,
      directory: false,
    })
    if (!sel || Array.isArray(sel)) return true
    if (!isPathUnderWorkspace(m.rootDir, sel)) {
      m.setStatus(m.t('app.menu.pickFileInWorkspace'))
      return true
    }
    await m.dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: m.rootDir,
      path: sel,
      source: 'menu',
    })
    return true
  },
}

export async function tryDispatchCoreAppAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
  themeCssName?: string,
): Promise<boolean> {
  void themeCssName
  const handler = CORE_APP_ACTIONS[action]
  if (!handler) return false
  return handler(m, ui, themeCssName)
}
