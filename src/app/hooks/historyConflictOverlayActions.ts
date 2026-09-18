import type { TranslateFn } from '../../i18n'
import { resumeAutosaveForPath } from '../../documentHistory/historyRestoreState'
import { deleteAllDocumentSnapshots, listDocumentSnapshots } from '../../documentHistory/historyRepository'
import { createManualSnapshotForDocument, restoreSnapshotToEditor } from '../../documentHistory/historyService'
import type { DocumentHistoryEntry } from '../../documentHistory/types'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { isWorkspaceMigratingError } from '../../platform/tauri/workspaceEncryptionService'
import {
  StaleWorkspaceSaveAbortedError,
  WorkspaceSaveUnlockCancelledError,
  dispatchSaveDocumentWithEncryptionRetryWithDeps,
  type EncryptedDocumentSaveDeps,
  type EncryptedDocumentSaveOptions,
} from '../../workspace/encryptedDocumentSave'
import { formatWorkspaceEncryptionErrorMessage, shouldAbortStaleWorkspaceSave, shouldRetrySaveAfterWorkspaceUnlock } from '../../workspace/workspaceEncryptionErrors'
import { ensureWorkspaceUnlocked, type WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'
import type { SaveConflictState } from '../document/saveConflictState'
import type { DocumentHistoryDialogContext } from '../components/DocumentHistoryDialog'
import type { AppStatusTone } from './useAppStatus'

type SetStatusFn = (message: string, toneOverride?: AppStatusTone) => void

export async function applyDiskFromSaveConflict(args: {
  conflict: SaveConflictState | null
  rootDir: string
  dispatchDocumentCommand: (command: {
    type: 'REVERT_DOCUMENT'
    root: string
    path: string
    source: 'save-conflict-disk'
  }) => Promise<unknown>
  refreshActiveEditorAfterPathReload: (path: string) => void
  setStatus: SetStatusFn
  t: TranslateFn
}): Promise<boolean> {
  const { conflict, rootDir, dispatchDocumentCommand, refreshActiveEditorAfterPathReload, setStatus, t } = args
  if (!conflict || !rootDir) return false
  try {
    await dispatchDocumentCommand({
      type: 'REVERT_DOCUMENT',
      root: rootDir,
      path: conflict.path,
      source: 'save-conflict-disk',
    })
    refreshActiveEditorAfterPathReload(conflict.path)
    setStatus(t('app.menu.revertedFromDisk'), 'info')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(t('app.status.operationFailed', { message }), 'error')
    return false
  }
}

/** External drift: dismiss conflict and keep unsaved editor content (no disk write). */
export async function keepLocalEditsFromExternalDrift(args: {
  conflict: SaveConflictState | null
  setStatus: SetStatusFn
  t: TranslateFn
}): Promise<boolean> {
  const { conflict, setStatus, t } = args
  if (!conflict) return false
  setStatus(t('app.status.externalFileChangedDirtyKept'), 'warning')
  return true
}

export type KeepLocalFromSaveConflictArgs = {
  conflict: SaveConflictState | null
  rootDir: string
  getCurrentRootDir?: () => string
  promptWorkspacePassword?: WorkspacePasswordPrompt
  markWorkspaceRefreshSuppressed: () => void
  setSavedAt: (value: string) => void
  refreshActiveEditorAfterPathReload: (path: string) => void
  setStatus: SetStatusFn
  t: TranslateFn
}

export async function keepLocalFromSaveConflictWithDeps(
  args: KeepLocalFromSaveConflictArgs,
  deps: EncryptedDocumentSaveDeps,
): Promise<boolean> {
  const {
    conflict,
    rootDir,
    getCurrentRootDir,
    promptWorkspacePassword,
    markWorkspaceRefreshSuppressed,
    setSavedAt,
    refreshActiveEditorAfterPathReload,
    setStatus,
    t,
  } = args
  if (!conflict || !rootDir) return false
  const rootAtRequest = rootDir
  const saveOptions: EncryptedDocumentSaveOptions = {
    rootAtRequest,
    getCurrentRootDir: getCurrentRootDir ?? (() => rootDir),
    path: conflict.path,
    content: conflict.local,
    source: 'save-conflict-force',
    allowUnlockRetry: true,
    forceOverwrite: true,
    promptWorkspacePassword,
    t,
  }
  try {
    await dispatchSaveDocumentWithEncryptionRetryWithDeps(saveOptions, deps)
    markWorkspaceRefreshSuppressed()
    setSavedAt(new Date().toLocaleTimeString())
    refreshActiveEditorAfterPathReload(conflict.path)
    setStatus(t('app.status.saved'), 'success')
    return true
  } catch (error) {
    if (error instanceof StaleWorkspaceSaveAbortedError) {
      return false
    }
    if (error instanceof WorkspaceSaveUnlockCancelledError) {
      setStatus(t('workspace.encryption.unlock.cancelled'), 'warning')
      return false
    }
    const encryptionMessage = formatWorkspaceEncryptionErrorMessage(error, t)
    if (encryptionMessage || isWorkspaceMigratingError(error)) {
      setStatus(encryptionMessage ?? t('workspace.encryption.error.migrating'), 'warning')
      return false
    }
    const message = error instanceof Error ? error.message : String(error)
    setStatus(t('app.status.saveFailed', { message }), 'error')
    return false
  }
}

export async function keepLocalFromSaveConflict(args: KeepLocalFromSaveConflictArgs): Promise<boolean> {
  return keepLocalFromSaveConflictWithDeps(args, {
    dispatchSave: async ({ root, path, content, source, forceOverwrite, expectedModifiedSecs }) => {
      await dispatchDocumentCommand({
        type: 'SAVE_DOCUMENT',
        root,
        path,
        content,
        source,
        forceOverwrite,
        expectedModifiedSecs,
      })
    },
    ensureUnlocked: ensureWorkspaceUnlocked,
    shouldAbortStale: shouldAbortStaleWorkspaceSave,
    shouldRetryUnlock: shouldRetrySaveAfterWorkspaceUnlock,
  })
}

export async function restoreFromDocumentHistory(args: {
  snapshotId: string
  context: DocumentHistoryDialogContext
  flushEditorToMemory: () => Promise<boolean>
  dispatchDocumentCommand: Parameters<typeof restoreSnapshotToEditor>[0]['dispatchDocumentCommand']
  refreshActiveEditorAfterPathReload?: (path: string) => void
  setStatus: SetStatusFn
  t: TranslateFn
  restoreSnapshot?: typeof restoreSnapshotToEditor
}): Promise<void> {
  const {
    snapshotId,
    context,
    flushEditorToMemory,
    dispatchDocumentCommand,
    refreshActiveEditorAfterPathReload,
    setStatus,
    t,
    restoreSnapshot = restoreSnapshotToEditor,
  } = args
  try {
    await restoreSnapshot({
      rootDir: context.rootDir,
      path: context.path,
      snapshotId,
      flushEditorToMemory,
      dispatchDocumentCommand,
    })
    refreshActiveEditorAfterPathReload?.(context.path)
    setStatus(t('app.history.restoredPendingSave'), 'warning')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(t('app.status.operationFailed', { message }), 'error')
    throw error
  }
}

export async function createFromDocumentHistory(args: {
  context: DocumentHistoryDialogContext
  flushEditorToMemory: () => Promise<boolean>
  setStatus: SetStatusFn
  t: TranslateFn
  createSnapshot?: typeof createManualSnapshotForDocument
}): Promise<DocumentHistoryEntry | null> {
  const { context, flushEditorToMemory, setStatus, t, createSnapshot = createManualSnapshotForDocument } = args
  const entry = await createSnapshot({
    rootDir: context.rootDir,
    path: context.path,
    flushEditorToMemory,
  })
  if (entry) setStatus(t('app.history.snapshotCreated'), 'success')
  return entry
}

export async function confirmDeleteFromDocumentHistory(args: {
  entry: DocumentHistoryEntry
  confirmAppDialog: (opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  t: TranslateFn
}): Promise<boolean> {
  const { entry: _entry, confirmAppDialog, t } = args
  return confirmAppDialog({
    title: t('app.history.dialog.title'),
    message: t('app.history.dialog.deleteConfirm'),
    confirmLabel: t('ctx.file.delete'),
    cancelLabel: t('app.rename.cancel'),
    variant: 'warning',
  })
}

export async function deleteAllFromDocumentHistory(args: {
  context: DocumentHistoryDialogContext
  confirmAppDialog: (opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
  setStatus: SetStatusFn
  t: TranslateFn
  deleteAll?: typeof deleteAllDocumentSnapshots
  listSnapshots?: typeof listDocumentSnapshots
}): Promise<boolean> {
  const {
    context,
    confirmAppDialog,
    setStatus,
    t,
    deleteAll = deleteAllDocumentSnapshots,
    listSnapshots = listDocumentSnapshots,
  } = args
  const entries = await listSnapshots({ rootDir: context.rootDir, path: context.path })
  if (entries.length === 0) return false
  const confirmed = await confirmAppDialog({
    title: t('app.history.dialog.title'),
    message: t('app.history.dialog.deleteAllConfirm', { count: entries.length }),
    confirmLabel: t('app.history.dialog.deleteAll'),
    cancelLabel: t('app.rename.cancel'),
    variant: 'warning',
  })
  if (!confirmed) return false
  const removed = await deleteAll({ rootDir: context.rootDir, path: context.path })
  resumeAutosaveForPath(context.path)
  setStatus(t('app.history.allSnapshotsDeleted', { count: removed }), 'success')
  return true
}
