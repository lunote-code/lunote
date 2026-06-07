import { useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

import { getBridgeEditorContext } from '../../editor/editorMutationBridge'
import type { AppMenuContext, AppMenuFileTreeNode, AppMenuUiDeps } from '../../menu'
import { buildNullEditorContext } from '../../menu/commandContext'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { openPreferencesDialog } from '../../preferences/preferencesDialogStore'
import { useSyncAppMenuContext } from './useSyncAppMenuContext'
import { INITIAL_NOTE_MD } from '../workspace/constants'
import type { SourceModeEnterAnchor } from '../../editor/viewportModeAnchor'
import type { AppExportFormat } from '../../markdownExport'
import type { OpenDailyNoteOutcome } from '../../templates/dailyNoteService'

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

export function createInitialAppMenuContext(): AppMenuContext {
  return {
    rootDir: '',
    activePath: '',
    content: '',
    recentFiles: [],
    setRootDir: (u: SetStateAction<string>) => {
      void u
    },
    dispatchDocumentCommand: async (command) => {
      void command
    },
    loadNotes: async (root: string, prefer?: string | null, _tabs?: string[] | null) => {
      void root
      void prefer
    },
    chooseFolder: async () => {},
    closeWorkspace: async () => {},
    saveCurrent: async (manual?: boolean) => {
      void manual
    },
    saveAsCurrent: async () => {},
    saveAllOpenTabs: async () => {},
    flushEditorToMemory: async () => true,
    refreshFileTree: async () => {},
    setFileTree: (u: SetStateAction<AppMenuFileTreeNode[]>) => {
      void u
    },
    setExpandedDirs: (u: SetStateAction<Set<string>>) => {
      void u
    },
    setStatus: (s: string) => {
      void s
    },
    t: (k: string, vars?: Record<string, string | number>) => {
      void vars
      return k
    },
    updateRecent: (p: string) => {
      void p
    },
    setRecentFiles: (u: SetStateAction<string[]>) => {
      void u
    },
    openRenameDialog: (root: string, oldPath: string, isDirectory: boolean) => {
      void root
      void oldPath
      void isDirectory
    },
    openNewNoteDialog: (root: string, parentPath: string, openInTab?: boolean, templatePath?: string) => {
      void root
      void parentPath
      void openInTab
      void templatePath
    },
    openNewNoteFromTemplateDialog: (root: string, parentPath: string, openInTab?: boolean) => {
      void root
      void parentPath
      void openInTab
    },
    confirmDeleteFile: async () => false,
    confirmAppDialog: async () => false,
    showAppAlert: async () => {},
    runAppExportFormat: async (format: AppExportFormat) => {
      void format
    },
    runAppPrint: async () => {},
    scratchNewDocument: async () => {},
    scratchNewTab: async () => {},
    openDailyNote: async (): Promise<OpenDailyNoteOutcome> => 'no-workspace',
    toggleMainPaneMode: () => {},
    openFindPanel: () => {},
    findNextInDocument: () => {},
    findPreviousInDocument: () => {},
    copySelectionAs: async () => {},
    cutSelectionToClipboard: async () => {},
    pastePlainFromClipboard: async () => {},
    insertImagesFromPicker: async () => {},
    mainPaneMode: 'visual',
    getEditorContext: () => buildNullEditorContext('visual'),
  }
}

export function createInitialAppMenuUiDeps(): AppMenuUiDeps {
  return {
    setFocusMode: () => {},
    setSidebarVisible: () => {},
    setSidebarListMode: () => {},
    getSidebarState: () => ({ visible: false, mode: 'files' }),
    openGlobalSearchModal: () => {},
    setStatusbarVisible: () => {},
    setAboutOpen: () => {},
    setCommandPaletteOpen: () => {},
    setCommandPaletteQuery: () => {},
    setCommandPaletteIndex: () => {},
    openDocumentHistoryDialog: () => {},
    openPreferencesDialog: () => {},
    setMainPaneMode: () => {},
    pendingSourceModeAnchorRef: { current: null },
    resetModeSwitchEditorBootstrap: () => {},
    initialNoteContent: INITIAL_NOTE_MD,
  }
}

export type AppCommandHostsDeps = {
  appMenuCtxRef: MutableRefObject<AppMenuContext>
  paletteUiDepsRef: MutableRefObject<AppMenuUiDeps>
  t: TranslateFn
  rootDir: string
  activePath: string
  content: string
  recentFiles: string[]
  setRootDir: Dispatch<SetStateAction<string>>
  loadNotes: (root: string, prefer?: string | null, tabs?: string[] | null) => Promise<void>
  chooseFolder: () => Promise<void>
  closeWorkspace: () => Promise<void>
  saveCurrent: (manual?: boolean) => Promise<void>
  saveAsCurrent: () => Promise<void>
  saveAllOpenTabs: () => Promise<void>
  flushEditorToMemory: () => Promise<boolean>
  refreshFileTree: () => Promise<void>
  setFileTree: Dispatch<SetStateAction<AppMenuFileTreeNode[]>>
  setExpandedDirs: Dispatch<SetStateAction<Set<string>>>
  setStatus: (msg: string) => void
  updateRecent: (path: string) => void
  setRecentFiles: Dispatch<SetStateAction<string[]>>
  openRenameDialog: (root: string, oldPath: string, isDirectory: boolean) => void
  openNewNoteDialog: (root: string, parentPath: string, openInTab?: boolean, templatePath?: string) => void
  openNewNoteFromTemplateDialog: (root: string, parentPath: string, openInTab?: boolean) => void
  confirmDeleteFile: (options: { title: string; message: string; fileLabel: string }) => Promise<boolean>
  confirmAppDialog: (options: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  showAppAlert: (options: { title: string; message: string; okLabel?: string }) => Promise<void>
  runAppExportFormat: (format: AppExportFormat) => Promise<void>
  runAppPrint: () => Promise<void>
  scratchNewDocument: () => Promise<void>
  scratchNewTab: () => Promise<void>
  openDailyNote: (dayOffset?: number) => Promise<OpenDailyNoteOutcome>
  toggleMainPaneMode: () => void
  openFindPanel: () => void
  findNextInDocument: () => void
  findPreviousInDocument: () => void
  copySelectionAs: (kind: 'plain' | 'markdown' | 'html') => Promise<void>
  cutSelectionToClipboard: () => Promise<void>
  pastePlainFromClipboard: (plainOnly?: boolean) => Promise<void>
  insertImagesFromPicker: () => Promise<void>
  mainPaneMode: 'visual' | 'source'
  setMainPaneMode: (mode: 'visual' | 'source') => void
  setFocusMode: Dispatch<SetStateAction<boolean>>
  setSidebarVisible: Dispatch<SetStateAction<boolean>>
  setSidebarListMode: Dispatch<SetStateAction<'files' | 'outline'>>
  sidebarVisible: boolean
  sidebarListMode: 'files' | 'outline'
  openGlobalSearchModal: () => void
  setStatusbarVisible: Dispatch<SetStateAction<boolean>>
  setAboutOpen: Dispatch<SetStateAction<boolean>>
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>
  setCommandPaletteQuery: Dispatch<SetStateAction<string>>
  setCommandPaletteIndex: Dispatch<SetStateAction<number>>
  openDocumentHistoryDialog: (root: string, path: string) => void
  pendingSourceModeAnchorRef: MutableRefObject<SourceModeEnterAnchor | null>
  resetModeSwitchEditorBootstrap: () => void
  closeTab: (path: string) => void
}

export function useAppCommandHosts({
  appMenuCtxRef,
  paletteUiDepsRef,
  t,
  rootDir,
  activePath,
  content,
  recentFiles,
  setRootDir,
  loadNotes,
  chooseFolder,
  closeWorkspace,
  saveCurrent,
  saveAsCurrent,
  saveAllOpenTabs,
  flushEditorToMemory,
  refreshFileTree,
  setFileTree,
  setExpandedDirs,
  setStatus,
  updateRecent,
  setRecentFiles,
  openRenameDialog,
  openNewNoteDialog,
  openNewNoteFromTemplateDialog,
  confirmDeleteFile,
  confirmAppDialog,
  showAppAlert,
  runAppExportFormat,
  runAppPrint,
  scratchNewDocument,
  scratchNewTab,
  openDailyNote,
  toggleMainPaneMode,
  openFindPanel,
  findNextInDocument,
  findPreviousInDocument,
  copySelectionAs,
  cutSelectionToClipboard,
  pastePlainFromClipboard,
  insertImagesFromPicker,
  mainPaneMode,
  setMainPaneMode,
  setFocusMode,
  setSidebarVisible,
  setSidebarListMode,
  sidebarVisible,
  sidebarListMode,
  openGlobalSearchModal,
  setStatusbarVisible,
  setAboutOpen,
  setCommandPaletteOpen,
  setCommandPaletteQuery,
  setCommandPaletteIndex,
  openDocumentHistoryDialog,
  pendingSourceModeAnchorRef,
  resetModeSwitchEditorBootstrap,
  closeTab,
}: AppCommandHostsDeps): void {
  const menuContext = useMemo(
    (): AppMenuContext => ({
      rootDir,
      activePath,
      content,
      recentFiles,
      setRootDir,
      dispatchDocumentCommand,
      loadNotes,
      chooseFolder,
      closeWorkspace,
      saveCurrent,
      saveAsCurrent,
      saveAllOpenTabs,
      flushEditorToMemory,
      refreshFileTree,
      setFileTree,
      setExpandedDirs,
      setStatus,
      t,
      updateRecent,
      setRecentFiles,
      openRenameDialog,
      openNewNoteDialog,
      openNewNoteFromTemplateDialog,
      confirmDeleteFile,
      confirmAppDialog,
      showAppAlert,
      runAppExportFormat,
      runAppPrint,
      scratchNewDocument,
      scratchNewTab,
      openDailyNote,
      toggleMainPaneMode,
      openFindPanel,
      findNextInDocument,
      findPreviousInDocument,
      copySelectionAs,
      cutSelectionToClipboard,
      pastePlainFromClipboard,
      insertImagesFromPicker,
      mainPaneMode,
      getEditorContext: getBridgeEditorContext,
    }),
    [
      rootDir,
      activePath,
      content,
      recentFiles,
      setRootDir,
      loadNotes,
      chooseFolder,
      closeWorkspace,
      saveCurrent,
      saveAsCurrent,
      saveAllOpenTabs,
      flushEditorToMemory,
      refreshFileTree,
      setFileTree,
      setExpandedDirs,
      setStatus,
      t,
      updateRecent,
      setRecentFiles,
      openRenameDialog,
      openNewNoteDialog,
      openNewNoteFromTemplateDialog,
      confirmDeleteFile,
      confirmAppDialog,
      showAppAlert,
      runAppExportFormat,
      runAppPrint,
      scratchNewDocument,
      scratchNewTab,
      openDailyNote,
      toggleMainPaneMode,
      openFindPanel,
      findNextInDocument,
      findPreviousInDocument,
      copySelectionAs,
      cutSelectionToClipboard,
      pastePlainFromClipboard,
      insertImagesFromPicker,
      mainPaneMode,
    ],
  )

  const paletteUiDeps = useMemo(
    (): AppMenuUiDeps => ({
      setFocusMode,
      setSidebarVisible,
      setSidebarListMode,
      getSidebarState: () => ({ visible: sidebarVisible, mode: sidebarListMode }),
      openGlobalSearchModal,
      setStatusbarVisible,
      setAboutOpen,
      setCommandPaletteOpen,
      setCommandPaletteQuery,
      setCommandPaletteIndex,
      openDocumentHistoryDialog,
      openPreferencesDialog,
      setMainPaneMode,
      pendingSourceModeAnchorRef,
      resetModeSwitchEditorBootstrap,
      initialNoteContent: INITIAL_NOTE_MD,
      closeActiveTab: (path: string) => {
        closeTab(path)
      },
      quitApp: () => {
        if (isTauri()) void getCurrentWindow().close()
        else window.close()
      },
    }),
    [
      setFocusMode,
      setSidebarVisible,
      setSidebarListMode,
      sidebarVisible,
      sidebarListMode,
      openGlobalSearchModal,
      setStatusbarVisible,
      setAboutOpen,
      setCommandPaletteOpen,
      setCommandPaletteQuery,
      setCommandPaletteIndex,
      openDocumentHistoryDialog,
      setMainPaneMode,
      pendingSourceModeAnchorRef,
      resetModeSwitchEditorBootstrap,
      closeTab,
    ],
  )

  useSyncAppMenuContext(appMenuCtxRef, paletteUiDepsRef, menuContext, paletteUiDeps)
}
