import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import type { DocumentHistoryEntry } from '../../documentHistory/types'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import type { SaveConflictState } from '../document/saveConflictState'
import type { DocumentHistoryDialogContext } from '../components/DocumentHistoryDialog'
import type { AppStatusTone } from './useAppStatus'
import {
  confirmDeleteFromDocumentHistory,
  createFromDocumentHistory,
  deleteAllFromDocumentHistory,
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
  saveConflict: SaveConflictState | null
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setDocumentHistoryDialog: Dispatch<SetStateAction<HistoryDialogState | null>>
  flushEditorToMemory: () => Promise<boolean>
  refreshActiveEditorAfterPathReload: (path: string) => void
  markWorkspaceRefreshSuppressed: () => void
  setSavedAt: (value: string) => void
  setStatus: (message: string, toneOverride?: AppStatusTone) => void
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
    saveConflict,
    setSaveConflict,
    setDocumentHistoryDialog,
    flushEditorToMemory,
    refreshActiveEditorAfterPathReload,
    markWorkspaceRefreshSuppressed,
    setSavedAt,
    setStatus,
    confirmAppDialog,
  } = args

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
    setSaveConflict(null)
  }, [saveConflictResolving, setSaveConflict])

  const onSaveConflictUseDisk = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict || !rootDir) {
        setStatus(t('app.saveConflict.missingContext'), 'error')
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
        if (ok) setSaveConflict(null)
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [refreshActiveEditorAfterPathReload, rootDir, setSaveConflict, setStatus, t])

  const onSaveConflictKeepLocal = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict || !rootDir) {
        setStatus(t('app.saveConflict.missingContext'), 'error')
        return
      }
      setSaveConflictResolving(true)
      try {
        const ok = await keepLocalFromSaveConflict({
          conflict,
          rootDir,
          dispatchDocumentCommand,
          markWorkspaceRefreshSuppressed,
          setSavedAt,
          refreshActiveEditorAfterPathReload,
          setStatus,
          t,
        })
        if (ok) setSaveConflict(null)
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [markWorkspaceRefreshSuppressed, refreshActiveEditorAfterPathReload, rootDir, setSaveConflict, setSavedAt, setStatus, t])

  const onDocumentHistoryRestore = useCallback(
    async (snapshotId: string, context: DocumentHistoryDialogContext) =>
      restoreFromDocumentHistory({
        snapshotId,
        context,
        flushEditorToMemory,
        dispatchDocumentCommand,
        setStatus,
        t,
      }),
    [flushEditorToMemory, setStatus, t],
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
