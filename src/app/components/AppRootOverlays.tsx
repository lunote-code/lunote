import type { RefObject } from 'react'

import { AlertDialog } from '../../components/AlertDialog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { UnsavedChangesDialog } from '../../components/UnsavedChangesDialog'
import { DeleteConfirmDialog } from '../../components/DeleteConfirmDialog'
import { PreferencesDialog } from '../../preferences/PreferencesDialog'
import { WorkspaceGlobalSearchModal } from './WorkspaceGlobalSearchModal'
import { KnowledgeHoverCard } from '../../editor/knowledgeOS/ui/KnowledgeHoverCard'
import { KnowledgeSearchModal } from '../../editor/knowledgeOS/ui/KnowledgeSearchModal'
import type { TranslateFn } from '../../i18n'
import type { PaletteCommandDef } from '../../menu'
import { AboutDialog } from '../../components/AboutDialog'
import type {
  AlertDialogState,
  ConfirmDialogState,
  DeleteConfirmDialogState,
  RenameDialogState,
  UnsavedChangesChoice,
  UnsavedChangesDialogState,
} from '../workspace/types'
import type {
  EditorDocMenuPick,
  EditorDocMenuState,
  FileContextMenuPick,
  FileContextMenuState,
  FileContextTarget,
  TabContextMenuPick,
} from '../workspace/contextMenuTypes'
import type { DocumentHistoryDialogContext } from './DocumentHistoryDialog'
import type { WorkspaceSearchIndexEntry } from '../search/workspaceSearch'
import { AppCommandPaletteOverlay } from './AppCommandPaletteOverlay'
import { AppRenameDialog } from './AppRenameDialog'
import { AppDocumentOverlayPortals } from './AppDocumentOverlayPortals'

export type AppRootOverlaysProps = {
  t: TranslateFn
  globalSearchOpen: boolean
  globalSearchQuery: string
  onGlobalSearchQueryChange: (q: string) => void
  onGlobalSearchClose: () => void
  globalSearchInputRef: RefObject<HTMLInputElement | null>
  knowledgeSearchOpen: boolean
  knowledgeSearchQuery: string
  onKnowledgeSearchQueryChange: (q: string) => void
  onKnowledgeSearchClose: () => void
  rootDir: string
  workspaceSearchIndex: readonly WorkspaceSearchIndexEntry[]
  onGlobalSearchOpenDocument: (root: string, path: string) => void | Promise<void>
  wikiHoverId: string | null
  commandPaletteOpen: boolean
  commandPaletteQuery: string
  commandPaletteIndex: number
  commandPaletteInputRef: RefObject<HTMLInputElement | null>
  paletteFiltered: PaletteCommandDef[]
  onCommandPaletteClose: () => void
  onCommandPaletteQueryChange: (q: string) => void
  onCommandPaletteIndexChange: (index: number) => void
  onRunPaletteCommand: (id: string) => void
  aboutOpen: boolean
  onAboutClose: () => void
  deleteConfirmDialog: DeleteConfirmDialogState | null
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  unsavedDialog: UnsavedChangesDialogState | null
  onUnsavedChoice: (choice: UnsavedChangesChoice) => void
  confirmDialog: ConfirmDialogState | null
  onConfirmDialog: (confirmed: boolean) => void
  alertDialog: AlertDialogState | null
  onAlertClose: () => void
  renameDialog: RenameDialogState | null
  renameInputValue: string
  renameError: string
  renameSubmitting: boolean
  renameInputRef: RefObject<HTMLInputElement | null>
  onRenameInputChange: (value: string) => void
  onRenameSubmit: () => void
  onRenameClose: () => void
  onRenameTemplateChange: (templatePath: string) => void
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

export function AppRootOverlays(props: AppRootOverlaysProps) {
  const {
    t,
    globalSearchOpen,
    globalSearchQuery,
    onGlobalSearchQueryChange,
    onGlobalSearchClose,
    globalSearchInputRef,
    knowledgeSearchOpen,
    knowledgeSearchQuery,
    onKnowledgeSearchQueryChange,
    onKnowledgeSearchClose,
    rootDir,
    workspaceSearchIndex,
    onGlobalSearchOpenDocument,
    wikiHoverId,
    commandPaletteOpen,
    commandPaletteQuery,
    commandPaletteIndex,
    commandPaletteInputRef,
    paletteFiltered,
    onCommandPaletteClose,
    onCommandPaletteQueryChange,
    onCommandPaletteIndexChange,
    onRunPaletteCommand,
    aboutOpen,
    onAboutClose,
    deleteConfirmDialog,
    onDeleteConfirm,
    onDeleteCancel,
    unsavedDialog,
    onUnsavedChoice,
    confirmDialog,
    onConfirmDialog,
    alertDialog,
    onAlertClose,
    renameDialog,
    renameInputValue,
    renameError,
    renameSubmitting,
    renameInputRef,
    onRenameInputChange,
    onRenameSubmit,
    onRenameClose,
    onRenameTemplateChange,
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
  } = props

  return (
    <>
      <WorkspaceGlobalSearchModal
        open={globalSearchOpen}
        query={globalSearchQuery}
        rootDir={rootDir}
        searchIndex={workspaceSearchIndex}
        onQueryChange={onGlobalSearchQueryChange}
        onClose={onGlobalSearchClose}
        inputRef={globalSearchInputRef}
        onOpenDocument={onGlobalSearchOpenDocument}
        t={t}
      />
      <KnowledgeSearchModal
        open={knowledgeSearchOpen}
        query={knowledgeSearchQuery}
        onQueryChange={onKnowledgeSearchQueryChange}
        onClose={onKnowledgeSearchClose}
      />
      <KnowledgeHoverCard hoverId={wikiHoverId} />
      <AppCommandPaletteOverlay
        t={t}
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        index={commandPaletteIndex}
        inputRef={commandPaletteInputRef}
        paletteFiltered={paletteFiltered}
        onClose={onCommandPaletteClose}
        onQueryChange={onCommandPaletteQueryChange}
        onIndexChange={onCommandPaletteIndexChange}
        onRunCommand={onRunPaletteCommand}
      />
      {aboutOpen ? <AboutDialog open={aboutOpen} onClose={onAboutClose} t={t} /> : null}
      <PreferencesDialog workspaceRoot={rootDir} />
      <DeleteConfirmDialog
        open={deleteConfirmDialog != null}
        title={deleteConfirmDialog?.title ?? ''}
        message={deleteConfirmDialog?.message ?? ''}
        fileLabel={deleteConfirmDialog?.fileLabel ?? ''}
        confirmLabel={t('ctx.file.delete')}
        cancelLabel={t('app.rename.cancel')}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
      />
      <UnsavedChangesDialog
        open={unsavedDialog != null}
        title={unsavedDialog?.title ?? ''}
        message={unsavedDialog?.message ?? ''}
        saveLabel={unsavedDialog?.saveLabel ?? t('app.unsaved.save')}
        discardLabel={unsavedDialog?.discardLabel ?? t('app.unsaved.discard')}
        cancelLabel={unsavedDialog?.cancelLabel ?? t('app.unsaved.cancel')}
        onSave={() => onUnsavedChoice('save')}
        onDiscard={() => onUnsavedChoice('discard')}
        onCancel={() => onUnsavedChoice('cancel')}
      />
      <ConfirmDialog
        open={confirmDialog != null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel ?? t('app.rename.submit')}
        cancelLabel={confirmDialog?.cancelLabel ?? t('app.rename.cancel')}
        variant={confirmDialog?.variant ?? 'default'}
        onConfirm={() => onConfirmDialog(true)}
        onCancel={() => onConfirmDialog(false)}
      />
      <AlertDialog
        open={alertDialog != null}
        title={alertDialog?.title ?? ''}
        message={alertDialog?.message ?? ''}
        okLabel={alertDialog?.okLabel ?? t('app.about.close')}
        onClose={onAlertClose}
      />
      <AppRenameDialog
        t={t}
        renameDialog={renameDialog}
        renameInputValue={renameInputValue}
        renameError={renameError}
        renameSubmitting={renameSubmitting}
        renameInputRef={renameInputRef}
        onRenameInputChange={onRenameInputChange}
        onRenameSubmit={onRenameSubmit}
        onRenameClose={onRenameClose}
        onRenameTemplateChange={onRenameTemplateChange}
      />
      <AppDocumentOverlayPortals
        t={t}
        fileContextMenu={fileContextMenu}
        fileContextMenuRef={fileContextMenuRef}
        onFileContextPick={onFileContextPick}
        editorDocMenu={editorDocMenu}
        editorDocMenuRef={editorDocMenuRef}
        editorDiskFileReady={editorDiskFileReady}
        editorCanRevealInOs={editorCanRevealInOs}
        onEditorDocMenuPick={onEditorDocMenuPick}
        tabContextMenu={tabContextMenu}
        tabContextMenuRef={tabContextMenuRef}
        onTabContextPick={onTabContextPick}
        saveConflictState={saveConflictState}
        documentHistoryState={documentHistoryState}
      />
    </>
  )
}
