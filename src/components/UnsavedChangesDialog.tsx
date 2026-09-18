import { useRef } from 'react'

import { DialogShell } from './dialog/DialogShell'
import { SettingsButton } from './settings'

export type UnsavedChangesDialogProps = {
  open: boolean
  title: string
  message: string
  saveLabel: string
  discardLabel: string
  cancelLabel: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

/**
 * Unsaved changes: Save / Not Save / Cancel.
 * Same visual shell as ConfirmDialog (warning), with one extra secondary action.
 */
export function UnsavedChangesDialog({
  open,
  title,
  message,
  saveLabel,
  discardLabel,
  cancelLabel,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <DialogShell
      open={open}
      title={title}
      description={message}
      titleId="unsaved-dialog-title"
      descId="unsaved-dialog-desc"
      tone="warning"
      initialFocusRef={cancelButtonRef}
      onEscape={onCancel}
      actionsClassName="confirm-modal-actions confirm-modal-actions-multi settings-inline-controls"
      actions={
        <>
          <SettingsButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </SettingsButton>
          <SettingsButton variant="secondary" onClick={onDiscard}>
            {discardLabel}
          </SettingsButton>
          <SettingsButton variant="primary" onClick={onSave}>
            {saveLabel}
          </SettingsButton>
        </>
      }
    />
  )
}
