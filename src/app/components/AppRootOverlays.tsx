import type { RefObject } from 'react'
import { createPortal } from 'react-dom'

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
import type { AppExportFormat } from '../../markdownExport'
import { WorkspaceFileContextMenu } from './WorkspaceFileContextMenu'
import { EditorDocumentContextMenu } from './EditorDocumentContextMenu'
import { TabContextMenu } from './TabContextMenu'
import { SaveConflictDialog } from './SaveConflictDialog'
import type { WorkspaceSearchIndexEntry } from '../search/workspaceSearch'

export type AppRootOverlaysProps = {
  t: TranslateFn
  globalSearchOpen: boolean
  globalSearchQuery: string
  onGlobalSearchQueryChange: (q: string) => void
  onGlobalSearchClose: () => void
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
  fileContextMenu: FileContextMenuState | null
  fileContextMenuRef: RefObject<HTMLDivElement | null>
  onFileContextPick: (action: FileContextMenuPick, ctx: FileContextTarget) => void
  editorDocMenu: EditorDocMenuState | null
  editorDocMenuRef: RefObject<HTMLDivElement | null>
  editorDiskFileReady: boolean
  editorCanRevealInOs: boolean
  onEditorDocMenuPick: (action: EditorDocMenuPick) => void
  onEditorTextColorPick: (color: string | null) => void
  onExportPick: (format: AppExportFormat) => void
  tabContextMenu: { x: number; y: number; path: string; index: number; total: number } | null
  tabContextMenuRef: RefObject<HTMLDivElement | null>
  onTabContextPick: (action: TabContextMenuPick, path: string, index: number) => void
  saveConflictOpen: boolean
  saveConflictPath: string
  saveConflictBase: string
  saveConflictLocal: string
  saveConflictDisk: string
  onSaveConflictCancel: () => void
  onSaveConflictUseDisk: () => void
  onSaveConflictKeepLocal: () => void
}

export function AppRootOverlays(props: AppRootOverlaysProps) {
  const {
    t,
    globalSearchOpen,
    globalSearchQuery,
    onGlobalSearchQueryChange,
    onGlobalSearchClose,
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
    fileContextMenu,
    fileContextMenuRef,
    onFileContextPick,
    editorDocMenu,
    editorDocMenuRef,
    editorDiskFileReady,
    editorCanRevealInOs,
    onEditorDocMenuPick,
    onEditorTextColorPick,
    onExportPick,
    tabContextMenu,
    tabContextMenuRef,
    onTabContextPick,
    saveConflictOpen,
    saveConflictPath,
    saveConflictBase,
    saveConflictLocal,
    saveConflictDisk,
    onSaveConflictCancel,
    onSaveConflictUseDisk,
    onSaveConflictKeepLocal,
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
      {commandPaletteOpen && (
        <div
          className="command-palette-backdrop"
          role="presentation"
          onClick={onCommandPaletteClose}
        >
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={t('app.commandPalette.aria')}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={commandPaletteInputRef}
              className="command-palette-input"
              placeholder={t('app.commandPalette.placeholder')}
              value={commandPaletteQuery}
              onChange={(e) => {
                onCommandPaletteQueryChange(e.target.value)
                onCommandPaletteIndexChange(0)
              }}
            />
            <ul className="command-palette-list">
              {paletteFiltered.length === 0 ? (
                <li className="command-palette-empty" key="empty">
                  {t('commandPalette.empty')}
                </li>
              ) : (
                paletteFiltered.map((c, idx) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="command-palette-item"
                      data-active={idx === commandPaletteIndex ? 'true' : undefined}
                      onClick={() => void onRunPaletteCommand(c.id)}
                      onMouseEnter={() => onCommandPaletteIndexChange(idx)}
                    >
                      <span className="command-palette-item-row">
                        <span className="command-palette-item-label">{c.label}</span>
                        {c.shortcut ? (
                          <kbd className="command-palette-item-shortcut">{c.shortcut}</kbd>
                        ) : null}
                      </span>
                      {c.hint ? <span className="command-palette-item-hint">{c.hint}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
      {aboutOpen ? <AboutDialog open={aboutOpen} onClose={onAboutClose} t={t} /> : null}
      <PreferencesDialog />
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
      {renameDialog && (
        <div
          className="about-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (renameSubmitting) return
            onRenameClose()
          }}
        >
          <div
            className="about-modal rename-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="rename-title" className="about-modal-title">
              {renameDialog.mode === 'newFolder'
                ? t('ctx.file.newFolder')
                : renameDialog.mode === 'newNote'
                  ? t('app.dialog.noteNewTitle')
                  : renameDialog.isDirectory
                    ? t('app.rename.folderTitle')
                    : t('app.rename.fileTitle')}
            </h2>
            <p className="about-modal-desc">
              {renameDialog.mode === 'newFolder'
                ? t('app.dialog.folderNew')
                : renameDialog.mode === 'newNote'
                  ? t('app.dialog.noteNewHint')
                  : t('app.rename.hint')}
            </p>
            <input
              ref={renameInputRef}
              className="rename-modal-input"
              value={renameInputValue}
              placeholder={
                renameDialog.mode === 'newNote'
                  ? t('app.dialog.noteNewPlaceholder', { default: t('app.defaults.newNoteStem') })
                  : undefined
              }
              onChange={(e) => onRenameInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !renameSubmitting) void onRenameSubmit()
                if (e.key === 'Escape' && !renameSubmitting) onRenameClose()
              }}
            />
            {renameError ? <p className="rename-modal-error">{renameError}</p> : null}
            <div className="rename-modal-actions">
              <button
                type="button"
                className="about-modal-close rename-modal-cancel"
                disabled={renameSubmitting}
                onClick={onRenameClose}
              >
                {t('app.rename.cancel')}
              </button>
              <button
                type="button"
                className="about-modal-close"
                disabled={renameSubmitting}
                onClick={() => void onRenameSubmit()}
              >
                {renameSubmitting ? t('app.rename.submitting') : t('app.rename.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
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
            onPick={onEditorDocMenuPick}
            onColorPick={onEditorTextColorPick}
            onExportPick={onExportPick}
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
        open={saveConflictOpen}
        path={saveConflictPath}
        basePreview={saveConflictBase}
        localPreview={saveConflictLocal}
        diskPreview={saveConflictDisk}
        onCancel={onSaveConflictCancel}
        onUseDisk={onSaveConflictUseDisk}
        onKeepLocal={onSaveConflictKeepLocal}
      />
    </>
  )
}
