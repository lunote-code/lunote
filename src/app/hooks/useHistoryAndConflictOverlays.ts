import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { clearExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import type { DocumentHistoryEntry } from '../../documentHistory/types'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'
import type { SaveConflictState } from '../document/saveConflictState'
import {
  isSaveConflictPromptPending,
  resolveSaveConflictPrompt,
} from '../document/saveConflictPrompt'
import type { DocumentHistoryDialogContext } from '../components/DocumentHistoryDialog'
import type { AppStatusTone } from './useAppStatus'
import {
  confirmDeleteFromDocumentHistory,
  createFromDocumentHistory,
  deleteAllFromDocumentHistory,
  keepLocalEditsFromExternalDrift,
  keepLocalFromSaveConflict,
  restoreFromDocumentHistory,
  applyDiskFromSaveConflict,
} from './historyConflictOverlayActions'

export type HistoryDialogState = {
  rootDir: string
  path: string
}

type UseHistoryAndConflictOverlaysArgs = {
  t: TranslateFn
  rootDir: string
  rootDirRef: React.MutableRefObject<string>
  promptWorkspacePassword?: WorkspacePasswordPrompt
  saveConflict: SaveConflictState | null
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setDocumentHistoryDialog: Dispatch<SetStateAction<HistoryDialogState | null>>
  flushEditorToMemory: () => Promise<boolean>
  refreshActiveEditorAfterPathReload: (path: string) => void
  markWorkspaceRefreshSuppressed: () => void
  setSavedAt: (value: string) => void
  setStatus: (message: string, toneOverride?: AppStatusTone) => void
  setExternalDiskChangedPaths: Dispatch<SetStateAction<Set<string>>>
  confirmAppDialog: (opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>
}

export function useHistoryAndConflictOverlays(args: UseHistoryAndConflictOverlaysArgs) {
  const {
    t,
    rootDir,
    rootDirRef,
    promptWorkspacePassword,
    saveConflict,
    setSaveConflict,
    setDocumentHistoryDialog,
    flushEditorToMemory,
    refreshActiveEditorAfterPathReload,
    markWorkspaceRefreshSuppressed,
    setSavedAt,
    setStatus,
    setExternalDiskChangedPaths,
    confirmAppDialog,
  } = args

  const clearExternalDiskDrift = useCallback(
    (path: string) => {
      setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, path))
    },
    [setExternalDiskChangedPaths],
  )

  const openDocumentHistoryDialog = useCallback((dialogRoot: string, dialogPath: string) => {
    setDocumentHistoryDialog({ rootDir: dialogRoot, path: dialogPath })
  }, [setDocumentHistoryDialog])

  const closeDocumentHistoryDialog = useCallback(() => {
    setDocumentHistoryDialog(null)
  }, [setDocumentHistoryDialog])

  const saveConflictRef = useRef(saveConflict)
  useEffect(() => {
    saveConflictRef.current = saveConflict
  }, [saveConflict])

  const [saveConflictResolving, setSaveConflictResolving] = useState(false)

  const onSaveConflictCancel = useCallback(() => {
    if (saveConflictResolving) return
    if (isSaveConflictPromptPending()) {
      resolveSaveConflictPrompt('cancel')
      setSaveConflict(null)
      return
    }
    setSaveConflict(null)
  }, [saveConflictResolving, setSaveConflict])

  const onSaveConflictUseDisk = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict || !rootDir) {
        setStatus(t('app.saveConflict.missingContext'), 'error')
        if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('cancel')
        return
      }
      setSaveConflictResolving(true)
      try {
        const ok = await applyDiskFromSaveConflict({
          conflict,
          rootDir,
          dispatchDocumentCommand,
          refreshActiveEditorAfterPathReload,
          setStatus,
          t,
        })
        if (ok) {
          clearExternalDiskDrift(conflict.path)
          if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('disk')
          setSaveConflict(null)
        } else if (isSaveConflictPromptPending()) {
          resolveSaveConflictPrompt('cancel')
        }
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [clearExternalDiskDrift, refreshActiveEditorAfterPathReload, rootDir, setSaveConflict, setStatus, t])

  const onSaveConflictKeepLocal = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict || !rootDir) {
        setStatus(t('app.saveConflict.missingContext'), 'error')
        if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('cancel')
        return
      }
      setSaveConflictResolving(true)
      try {
        const ok =
          conflict.sourceMode === 'external'
            ? await keepLocalEditsFromExternalDrift({ conflict, setStatus, t })
            : await keepLocalFromSaveConflict({
                conflict,
                rootDir,
                getCurrentRootDir: () => rootDirRef.current,
                promptWorkspacePassword,
                markWorkspaceRefreshSuppressed,
                setSavedAt,
                refreshActiveEditorAfterPathReload,
                setStatus,
                t,
              })
        if (ok) {
          clearExternalDiskDrift(conflict.path)
          if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('local')
          setSaveConflict(null)
        } else if (isSaveConflictPromptPending()) {
          resolveSaveConflictPrompt('cancel')
        }
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [clearExternalDiskDrift, markWorkspaceRefreshSuppressed, promptWorkspacePassword, refreshActiveEditorAfterPathReload, rootDir, rootDirRef, setSaveConflict, setSavedAt, setStatus, t])

  const onDocumentHistoryRestore = useCallback(
    async (snapshotId: string, context: DocumentHistoryDialogContext) =>
      restoreFromDocumentHistory({
        snapshotId,
        context,
        flushEditorToMemory,
        dispatchDocumentCommand,
        refreshActiveEditorAfterPathReload,
        setStatus,
        t,
      }),
    [flushEditorToMemory, refreshActiveEditorAfterPathReload, setStatus, t],
  )

  const onDocumentHistoryCreateSnapshot = useCallback(
    async (context: DocumentHistoryDialogContext) =>
      createFromDocumentHistory({
        context,
        flushEditorToMemory,
        setStatus,
        t,
      }),
    [flushEditorToMemory, setStatus, t],
  )

  const onDocumentHistoryConfirmDelete = useCallback(
    async (entry: DocumentHistoryEntry) =>
      confirmDeleteFromDocumentHistory({
        entry,
        confirmAppDialog,
        t,
      }),
    [confirmAppDialog, t],
  )

  const onDocumentHistoryDeleteAll = useCallback(
    async (context: DocumentHistoryDialogContext) =>
      deleteAllFromDocumentHistory({
        context,
        confirmAppDialog,
        setStatus,
        t,
      }),
    [confirmAppDialog, setStatus, t],
  )

  return {
    openDocumentHistoryDialog,
    closeDocumentHistoryDialog,
    saveConflictResolving,
    onSaveConflictCancel,
    onSaveConflictUseDisk,
    onSaveConflictKeepLocal,
    onDocumentHistoryRestore,
    onDocumentHistoryCreateSnapshot,
    onDocumentHistoryConfirmDelete,
    onDocumentHistoryDeleteAll,
  }
}
