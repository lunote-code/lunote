import { useCallback, useRef, useState } from 'react'

import type { TranslateFn } from '../../i18n'
import type {
  AlertDialogState,
  ConfirmDialogState,
  DeleteConfirmDialogState,
  UnsavedChangesChoice,
  UnsavedChangesDialogState,
} from '../workspace/types'

export function useAppDialogs(t: TranslateFn) {
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<DeleteConfirmDialogState | null>(null)
  const deleteConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const confirmDialogResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [unsavedDialog, setUnsavedDialog] = useState<UnsavedChangesDialogState | null>(null)
  const unsavedDialogResolverRef = useRef<((choice: UnsavedChangesChoice) => void) | null>(null)
  const confirmAppDialogRef = useRef<
    (options: {
      title: string
      message: string
      confirmLabel?: string
      cancelLabel?: string
      variant?: 'default' | 'warning'
    }) => Promise<boolean>
  >(async () => false)
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null)
  const alertDialogResolverRef = useRef<(() => void) | null>(null)

  const confirmDeleteFile = useCallback(
    (options: DeleteConfirmDialogState) =>
      new Promise<boolean>((resolve) => {
        deleteConfirmResolverRef.current = resolve
        setDeleteConfirmDialog(options)
      }),
    [],
  )

  const closeDeleteConfirmDialog = useCallback((confirmed: boolean) => {
    deleteConfirmResolverRef.current?.(confirmed)
    deleteConfirmResolverRef.current = null
    setDeleteConfirmDialog(null)
  }, [])

  const confirmAppDialog = useCallback(
    (options: {
      title: string
      message: string
      confirmLabel?: string
      cancelLabel?: string
      variant?: 'default' | 'warning'
    }) =>
      new Promise<boolean>((resolve) => {
        confirmDialogResolverRef.current = resolve
        setConfirmDialog({
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? t('app.rename.submit'),
          cancelLabel: options.cancelLabel ?? t('app.rename.cancel'),
          variant: options.variant ?? 'default',
        })
      }),
    [t],
  )
  confirmAppDialogRef.current = confirmAppDialog

  const closeConfirmDialog = useCallback((confirmed: boolean) => {
    confirmDialogResolverRef.current?.(confirmed)
    confirmDialogResolverRef.current = null
    setConfirmDialog(null)
  }, [])

  const promptUnsavedChanges = useCallback(
    (options: {
      title?: string
      message: string
      saveLabel?: string
      discardLabel?: string
      cancelLabel?: string
    }): Promise<UnsavedChangesChoice> =>
      new Promise((resolve) => {
        unsavedDialogResolverRef.current = resolve
        setUnsavedDialog({
          title: options.title ?? t('app.unsaved.title'),
          message: options.message,
          saveLabel: options.saveLabel ?? t('app.unsaved.save'),
          discardLabel: options.discardLabel ?? t('app.unsaved.discard'),
          cancelLabel: options.cancelLabel ?? t('app.unsaved.cancel'),
        })
      }),
    [t],
  )

  const closeUnsavedDialog = useCallback((choice: UnsavedChangesChoice) => {
    unsavedDialogResolverRef.current?.(choice)
    unsavedDialogResolverRef.current = null
    setUnsavedDialog(null)
  }, [])

  const showAppAlert = useCallback(
    (options: { title: string; message: string; okLabel?: string }) =>
      new Promise<void>((resolve) => {
        alertDialogResolverRef.current = resolve
        setAlertDialog({
          title: options.title,
          message: options.message,
          okLabel: options.okLabel ?? t('app.about.close'),
        })
      }),
    [t],
  )

  const closeAlertDialog = useCallback(() => {
    alertDialogResolverRef.current?.()
    alertDialogResolverRef.current = null
    setAlertDialog(null)
  }, [])

  return {
    deleteConfirmDialog,
    confirmDialog,
    unsavedDialog,
    alertDialog,
    confirmAppDialog,
    confirmAppDialogRef,
    confirmDeleteFile,
    closeDeleteConfirmDialog,
    closeConfirmDialog,
    promptUnsavedChanges,
    closeUnsavedDialog,
    showAppAlert,
    closeAlertDialog,
  }
}
