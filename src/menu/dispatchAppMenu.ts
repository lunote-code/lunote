import { isTauri } from '@tauri-apps/api/core'
import { tryExecuteResolvedManifestAction } from './commandExecute'
import { createTransaction, executeOps } from './commandTransaction'
import type { AppMenuContext, AppMenuTauriPayload, AppMenuUiDeps } from './menu.types'
import { ancestorDirPathsForFile, isPathUnderWorkspace, parentDirectoryOfFile } from '../lib/workspacePathUtils'
import { tryDispatchExtendedMenuAction } from './menuActionExtended'
import { openExternalUrlInSystemBrowser } from '../editor/openExternalLink'
import { setSetting } from '../settings-runtime/settingsRuntime'
import { THEME_CATALOG } from '../theme-runtime/themeCatalog'
import { clearPreviewTheme, setPreviewTheme } from '../theme-runtime/themeRuntime'
import { buildHelpFeedbackMailto, HELP_URL_PRIVACY, HELP_URL_WEBSITE } from './helpMenuUrls'
import { normalizeThemeVariant } from '../theme-runtime/themeResolver'
import { tryDispatchCoreAppAction } from './appActionRegistry'
import { tryDispatchFileAppAction } from './fileActionRegistry'
import { tryDispatchViewAppAction } from './viewActionRegistry'
import { resolveManifestActionFromMenuAction } from './menuActionMapping'
import { revealThemeDirectory } from '../platform/tauri/themeService'
import { reloadThemeStylesheetsFromDisk } from '../theme-runtime/themeStylesheetRuntime'
import { raiseMainWindow } from '../platform/tauri/raiseMainWindow'

const RAISE_WINDOW_DAILY_NOTE_ACTIONS = new Set([
  'daily-note-open',
  'daily-note-open-yesterday',
  'daily-note-open-tomorrow',
])

const THEME_MENU_ACTIONS: Record<string, string> = Object.fromEntries(
  THEME_CATALOG.map((entry) => [`theme-${entry.id}`, entry.id]),
)

async function openHelpUrl(m: AppMenuContext, url: string): Promise<void> {
  try {
    await openExternalUrlInSystemBrowser(url)
  } catch (e) {
    m.setStatus(m.t('app.menu.linkOpenFailed', { message: e instanceof Error ? e.message : String(e) }))
  }
}

/** Handle Tauri main process `app-menu` event (please use `dispatchAppMenuAction` to share logic with the command panel)*/
export async function dispatchAppMenuFromTauri(
  getCtx: () => AppMenuContext,
  payload: AppMenuTauriPayload,
  ui: AppMenuUiDeps,
): Promise<void> {
  const m = getCtx()
  const { action: rawAction, path: recentPath, name: themeCssName, url: helpUrl } = payload
  const action = resolveManifestActionFromMenuAction(rawAction)
  if (import.meta.env.DEV && rawAction !== action) {
    console.debug('[app-menu][normalized]', { rawAction, action })
  }

  if (action === 'help-open-url' && helpUrl) {
    await openHelpUrl(m, helpUrl)
    return
  }

  if (action === 'quick-capture-show') {
    await raiseMainWindow()
    return
  }

  if (isTauri() && RAISE_WINDOW_DAILY_NOTE_ACTIONS.has(action)) {
    await raiseMainWindow()
  }

  if (action === 'open-recent' && recentPath) {
    void (async () => {
      let targetRoot = m.rootDir
      let loadedWorkspace = false
      if (!targetRoot || !isPathUnderWorkspace(targetRoot, recentPath)) {
        targetRoot = parentDirectoryOfFile(recentPath)
        if (!targetRoot) {
          m.setStatus(m.t('app.menu.recentDirUnavailable'))
          return
        }
        await m.loadNotes(targetRoot, recentPath)
        loadedWorkspace = true
      }
      ui.setFocusMode(false)
      ui.setSidebarVisible(true)
      const ancestors = ancestorDirPathsForFile(targetRoot, recentPath)
      m.setExpandedDirs((prev) => {
        const next = new Set(prev)
        for (const d of ancestors) {
          next.add(d)
        }
        return next
      })
      if (!loadedWorkspace) {
        await m.dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT',
          root: targetRoot,
          path: recentPath,
          source: 'menu',
        })
      }
    })()
    return
  }

  if (action.startsWith('fmt-code-')) {
    // Dynamic Tauri code-block commands routed through Transaction VM
    const lang = action.slice('fmt-code-'.length) || 'text'
    const ctx = m.getEditorContext()
    const resolved =
      ctx.mode === 'source'
        ? { kind: 'source-command' as const, commandId: action, op: { kind: 'insert-code-fence' as const, language: lang } }
        : { kind: 'tiptap-command' as const, commandId: action, command: { type: 'codeBlock' as const, language: lang } }
    const tx = createTransaction(resolved)
    if (tx) { executeOps(tx) }
    return
  }

  await dispatchAppMenuAction(action, m, ui, themeCssName)
}

function logUnhandled(action: string): void {
  if (import.meta.env.DEV) console.debug('[app-menu] unhandled action', action)
}

/** Aligned with top bar menu id; command panels can be mapped to this via alias*/
export async function dispatchAppMenuAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
  themeCssName?: string,
): Promise<void> {
  if (import.meta.env.DEV && (action === 'preferences' || action === 'fmt-clear-style')) {
    console.debug('[app-menu][dispatch]', { action })
  }
  if (await tryDispatchCoreAppAction(action, m, ui, themeCssName)) return
  if (await tryExecuteResolvedManifestAction(action, m, ui)) return
  if (await tryDispatchFileAppAction(action, m, ui)) return
  if (action === 'app-quit') {
    void ui.quitApp?.()
    return
  }
  if (await tryDispatchViewAppAction(action, m, ui)) return
  const themeMenuAction = THEME_MENU_ACTIONS[action]
  if (themeMenuAction) {
    void setSetting('theme.active', themeMenuAction)
    return
  }
  if (action === 'theme-css-select' && themeCssName) {
    void setSetting('theme.cssFile', themeCssName)
    return
  }
  if (action === 'theme-preview') {
    const byCatalog = themeCssName
      ? THEME_CATALOG.find((entry) => entry.id === themeCssName || entry.name === themeCssName)
      : undefined
    if (byCatalog) setPreviewTheme(normalizeThemeVariant(byCatalog.id))
    return
  }
  if (action === 'theme-preview-clear') {
    clearPreviewTheme()
    return
  }
  if (action === 'theme-refresh-css-list') {
    void reloadThemeStylesheetsFromDisk()
    return
  }
  if (action === 'theme-open-folder') {
    if (!isTauri()) return
    await revealThemeDirectory()
    return
  }
  if (action === 'help-about') {
    ui.setAboutOpen(true)
    return
  }
  if (action === 'help-privacy') {
    await openHelpUrl(m, HELP_URL_PRIVACY)
    return
  }
  if (action === 'help-website') {
    await openHelpUrl(m, HELP_URL_WEBSITE)
    return
  }
  if (action === 'help-feedback') {
    await openHelpUrl(m, buildHelpFeedbackMailto(m.t('menu.native.help.feedbackMailSubject')))
    return
  }
  // para-h1..h6 / para-ul / para-ol / para-task / para-quote are now handled by
  // COMMAND_RESOLUTION_REGISTRY → Transaction VM. They should not reach here.
  if (await tryDispatchExtendedMenuAction(action, m, ui)) return

  logUnhandled(action)
}
