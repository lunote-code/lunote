import type { SetStateAction } from 'react'
import type { SemanticIconName } from '../design-system/icons'
import type { PrefsTabId } from '../preferences/types'
import type { EditorContext, EditorPaneMode } from './commandContext'
import type { SourceModeEnterAnchor } from '../editor/viewportModeAnchor'
import type { AppExportFormat } from '../markdownExport'
import type { DocumentCommand } from '../documentRuntime/documentTypes'
import type { OpenDailyNoteOutcome } from '../templates/dailyNoteService'

/** Aligned subset of Electron `MenuItemConstructorOptions` (for future integration into Electron or documentation)*/
export type ElectronCompatibleMenuItem = {
  id?: string
  label?: string
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio'
  accelerator?: string
  enabled?: boolean
  checked?: boolean
  submenu?: ElectronCompatibleMenuItem[]
  role?: string
  click?: (() => void) | undefined
}

export type MenuSeparator = { kind: 'separator'; id?: string }

export type MenuLeaf = {
  kind: 'item'
  /** Stable identification: consistent with Tauri menu id, app-menu payload.action*/
  id: string
  /** i18n key*/
  labelKey: string
  /** Logical command, default equal to id*/
  action?: string
  /** Cross-platform shortcut key description, such as Mod+s / Mod+Shift+f (must come from commandRegistry)*/
  accelerator?: string
  /** Typora style menu prefix icon (from commandRegistry)*/
  menuIcon?: string
  /** Lucide icon for in-app menu bar (when menuIcon glyph is absent)*/
  semanticIcon?: SemanticIconName
  /** Preset text color dot for format → text color menu items*/
  menuColorSwatch?: string | 'default'
  /** appears in the command panel*/
  palette?: boolean
  /** Command panel supplement search terms*/
  paletteKeywords?: string[]
  /** command panel subtitle*/
  paletteHint?: string
  itemType?: 'normal' | 'checkbox' | 'radio'
}

export type MenuSubmenu = {
  kind: 'submenu'
  id: string
  labelKey: string
  semanticIcon?: SemanticIconName
  children: MenuNode[]
}

export type MenuNode = MenuSeparator | MenuLeaf | MenuSubmenu

export type MenuBarGroup = {
  kind: 'submenu'
  id: string
  labelKey: string
  children: MenuNode[]
}

export type MenuSchemaRoot = {
  version: 1
  /** Top-level menu bar grouping (each corresponding to a drop-down menu)*/
  bar: MenuBarGroup[]
}

export type MenuItemState = {
  enabled?: boolean
  checked?: boolean
}

/** The chain of submenu ids grouped from the top bar to the current leaf parent (excluding the leaf itself)*/
export type ResolveMenuItemStateContext = {
  path: readonly string[]
}

export type ResolveMenuItemState = (leaf: MenuLeaf, ctx: ResolveMenuItemStateContext) => MenuItemState

/** i18n key path for command panel breadcrumbs: grouped/nested submenu*/
export type MenuPathSegment = { id: string; labelKey: string }

export type AppMenuTauriPayload = {
  action: string
  path?: string
  name?: string
  url?: string
}

export type AppMenuFileTreeNode = {
  name: string
  path: string
  kind: string
  modifiedAtMs?: number | null
  createdAtMs?: number | null
  children: AppMenuFileTreeNode[]
}

export type AppMenuContext = {
  rootDir: string
  activePath: string
  content: string
  recentFiles: string[]
  setRootDir: (u: SetStateAction<string>) => void
  dispatchDocumentCommand: (command: DocumentCommand) => Promise<string | void>
  loadNotes: (root: string, prefer?: string | null, restoredOpenTabs?: string[] | null) => Promise<void>
  chooseFolder: () => Promise<void>
  closeWorkspace: () => Promise<void>
  saveCurrent: (manual?: boolean) => Promise<void>
  saveAsCurrent?: () => Promise<void>
  saveAllOpenTabs: () => Promise<void>
  flushEditorToMemory: () => Promise<boolean>
  refreshFileTree: () => Promise<void>
  setFileTree: (u: SetStateAction<AppMenuFileTreeNode[]>) => void
  setExpandedDirs: (u: SetStateAction<Set<string>>) => void
  setStatus: (s: string) => void
  /** Translation function for the current language (same origin as React `useI18n().t`, used by menu/non-component logic)*/
  t: (key: string, vars?: Record<string, string | number>) => string
  updateRecent: (p: string) => void
  setRecentFiles: (u: SetStateAction<string[]>) => void
  openRenameDialog: (root: string, oldPath: string, isDirectory: boolean) => void
  openNewNoteDialog: (root: string, parentPath: string, openInTab?: boolean, templatePath?: string) => void
  openNewNoteFromTemplateDialog: (root: string, parentPath: string, openInTab?: boolean) => void
  confirmDeleteFile: (options: {
    title: string
    message: string
    fileLabel: string
  }) => Promise<boolean>
  confirmAppDialog: (options: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  showAppAlert: (options: { title: string; message: string; okLabel?: string }) => Promise<void>
  runAppExportFormat: (f: AppExportFormat) => Promise<void>
  runAppPrint: () => Promise<void>
  scratchNewDocument: () => Promise<void>
  scratchNewTab: () => Promise<void>
  /** dayOffset 0 = today, -1 = yesterday, 1 = tomorrow */
  openDailyNote: (dayOffset?: number) => Promise<OpenDailyNoteOutcome>
  toggleMainPaneMode: () => void
  openFindPanel: () => void
  findNextInDocument: () => void
  findPreviousInDocument: () => void
  copySelectionAs: (kind: 'plain' | 'markdown' | 'html') => Promise<void>
  cutSelectionToClipboard: () => Promise<void>
  pastePlainFromClipboard: (plainOnly?: boolean) => Promise<void>
  insertImagesFromPicker: () => Promise<void>
  /** Current main editing area mode (for command parsing)*/
  mainPaneMode: EditorPaneMode
  /**
   * Produces an EditorContext snapshot for resolveCommand.
   * Implemented via EditorMutationBridge — no editor refs on AppMenuContext.
   */
  getEditorContext: () => EditorContext
}

export type AppMenuUiDeps = {
  setFocusMode: (u: SetStateAction<boolean>) => void
  setSidebarVisible: (u: SetStateAction<boolean>) => void
  setSidebarListMode: (u: SetStateAction<'files' | 'outline'>) => void
  getSidebarState: () => { visible: boolean; mode: 'files' | 'outline' }
  openGlobalSearchModal: () => void
  setStatusbarVisible: (u: SetStateAction<boolean>) => void
  setAboutOpen: (u: SetStateAction<boolean>) => void
  setCommandPaletteOpen: (u: SetStateAction<boolean>) => void
  setCommandPaletteQuery: (u: SetStateAction<string>) => void
  setCommandPaletteIndex: (u: SetStateAction<number>) => void
  openDocumentHistoryDialog: (root: string, path: string) => void
  openPreferencesDialog: (tab?: PrefsTabId) => void
  setMainPaneMode: (mode: 'visual' | 'source') => void
  pendingSourceModeAnchorRef: { current: SourceModeEnterAnchor | null }
  /** Clear mode switch bootstrap (source code initial selection / WYSIWYG atom entry payload)*/
  resetModeSwitchEditorBootstrap: () => void /** Cold open / switch doc: clear mode-switch refs and FSM anchor/semantic state */
  initialNoteContent: string
  closeActiveTab?: (path: string) => void
  quitApp?: () => void
}

export type PaletteCommandDef = {
  id: string
  label: string
  hint: string
  keywords: string[]
  /** Display shortcut keys (consistent with manifest)*/
  shortcut?: string
}

/** Toolbar buttons: compiled by command manifest*/
export type ToolbarCommandDef = {
  id: string
  label: string
  title: string
  icon?: string
  shortcut?: string
}

export type ToolbarButtonItem = { kind: 'button' } & ToolbarCommandDef

export type ToolbarDropdownItem = {
  kind: 'dropdown'
  id: string
  label: string
  title: string
  items: ToolbarCommandDef[]
}

export type ToolbarItemDef = ToolbarButtonItem | ToolbarDropdownItem

export function isToolbarButton(item: ToolbarItemDef): item is ToolbarButtonItem {
  return item.kind === 'button'
}
