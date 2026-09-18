import { useRef } from 'react'

import { DialogShell } from './dialog/DialogShell'
import { SettingsButton } from './settings'

export type AlertDialogProps = {
  open: boolean
  title: string
  message: string
  okLabel: string
  onClose: () => void
}

export function AlertDialog({ open, title, message, okLabel, onClose }: AlertDialogProps) {
  const okButtonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <DialogShell
      open={open}
      title={title}
      description={message}
      titleId="alert-dialog-title"
      descId="alert-dialog-desc"
      tone="default"
      onBackdropClick={onClose}
      onEscape={onClose}
      initialFocusRef={okButtonRef}
      panelClassName="alert-modal"
      descriptionClassName="alert-modal-desc"
      actionsClassName="confirm-modal-actions"
      actions={
        <SettingsButton
          ref={okButtonRef}
          variant="primary"
          className="confirm-modal-single-ok"
          onClick={onClose}
        >
          {okLabel}
        </SettingsButton>
      }
    />
  )
}
