import { createPortal } from 'react-dom'
import type { RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { WorkspaceFileContextMenu } from './WorkspaceFileContextMenu'
import { EditorDocumentContextMenu } from './EditorDocumentContextMenu'
import { TabContextMenu } from './TabContextMenu'
import { SaveConflictDialog } from './SaveConflictDialog'
import { DocumentHistoryDialog, type DocumentHistoryDialogContext } from './DocumentHistoryDialog'
import type {
  EditorDocMenuPick,
  EditorDocMenuState,
  FileContextMenuPick,
  FileContextMenuState,
  FileContextTarget,
  TabContextMenuPick,
} from '../workspace/contextMenuTypes'

type Props = {
  t: TranslateFn
  fileContextMenu: FileContextMenuState | null
  fileContextMenuRef: RefObject<HTMLDivElement | null>
  onFileContextPick: (action: FileContextMenuPick, ctx: FileContextTarget) => void
  editorDocMenu: EditorDocMenuState | null
  editorDocMenuRef: RefObject<HTMLDivElement | null>
  editorDiskFileReady: boolean
  editorCanRevealInOs: boolean
  onEditorDocMenuPick: (action: EditorDocMenuPick, menu: EditorDocMenuState) => void
  tabContextMenu: { x: number; y: number; path: string; index: number; total: number } | null
  tabContextMenuRef: RefObject<HTMLDivElement | null>
  onTabContextPick: (action: TabContextMenuPick, path: string, index: number) => void
  saveConflictState: {
    open: boolean
    path: string
    base: string
    local: string
    disk: string
    diskReadable: boolean
    sourceMode: 'manual' | 'autosave'
    resolving?: boolean
    onCancel: () => void
    onUseDisk: () => void
    onKeepLocal: () => void
  }
  documentHistoryState: {
    open: boolean
    rootDir: string
    path: string
    onClose: () => void
    onRestore: (snapshotId: string, context: DocumentHistoryDialogContext) => Promise<void> | void
    onCreateSnapshot: (
      context: DocumentHistoryDialogContext,
    ) => Promise<import('../../documentHistory/types').DocumentHistoryEntry | null> | import('../../documentHistory/types').DocumentHistoryEntry | null
    onConfirmDelete: (entry: import('../../documentHistory/types').DocumentHistoryEntry) => Promise<boolean> | boolean
    onDeleteAll: (context: DocumentHistoryDialogContext) => Promise<boolean> | boolean
  }
}

export function AppDocumentOverlayPortals({
  t,
  fileContextMenu,
  fileContextMenuRef,
  onFileContextPick,
  editorDocMenu,
  editorDocMenuRef,
  editorDiskFileReady,
  editorCanRevealInOs,
  onEditorDocMenuPick,
  tabContextMenu,
  tabContextMenuRef,
  onTabContextPick,
  saveConflictState,
  documentHistoryState,
}: Props) {
  return (
    <>
      {typeof document !== 'undefined' &&
        fileContextMenu &&
        createPortal(
          <WorkspaceFileContextMenu
            state={fileContextMenu}
            menuRef={fileContextMenuRef}
            onPick={onFileContextPick}
          />,
          document.body,
        )}
      {typeof document !== 'undefined' &&
        editorDocMenu &&
        createPortal(
          <EditorDocumentContextMenu
            state={editorDocMenu}
            menuRef={editorDocMenuRef}
            diskFileReady={editorDiskFileReady}
            canRevealInOs={editorCanRevealInOs}
            onPick={(action) => onEditorDocMenuPick(action, editorDocMenu)}
          />,
          document.body,
        )}
      {typeof document !== 'undefined' &&
        tabContextMenu &&
        createPortal(
          <TabContextMenu
            state={tabContextMenu}
            menuRef={tabContextMenuRef}
            onPick={onTabContextPick}
          />,
          document.body,
        )}
      <SaveConflictDialog
        t={t}
        open={saveConflictState.open}
        path={saveConflictState.path}
        basePreview={saveConflictState.base}
        localPreview={saveConflictState.local}
        diskPreview={saveConflictState.disk}
        diskReadable={saveConflictState.diskReadable}
        sourceMode={saveConflictState.sourceMode}
        resolving={saveConflictState.resolving}
        onCancel={saveConflictState.onCancel}
        onUseDisk={saveConflictState.onUseDisk}
        onKeepLocal={saveConflictState.onKeepLocal}
      />
      <DocumentHistoryDialog
        t={t}
        open={documentHistoryState.open}
        rootDir={documentHistoryState.rootDir}
        path={documentHistoryState.path}
        onClose={documentHistoryState.onClose}
        onRestore={documentHistoryState.onRestore}
        onCreateSnapshot={documentHistoryState.onCreateSnapshot}
        onConfirmDeleteSnapshot={documentHistoryState.onConfirmDelete}
        onDeleteAllSnapshots={documentHistoryState.onDeleteAll}
      />
    </>
  )
}
