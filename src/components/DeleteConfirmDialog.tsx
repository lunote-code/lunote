import { useRef } from 'react'

import { DialogShell } from './dialog/DialogShell'
import { SettingsButton } from './settings'

export type DeleteConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  fileLabel: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  title,
  message,
  fileLabel,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <DialogShell
      open={open}
      title={title}
      description={message}
      titleId="delete-confirm-title"
      descId="delete-confirm-desc"
      tone="destructive"
      initialFocusRef={cancelButtonRef}
      onEscape={onCancel}
      actionsClassName="rename-modal-actions delete-modal-actions"
      children={
        <div className="delete-modal-file" title={fileLabel}>
          <span className="delete-modal-file-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="delete-modal-file-name">{fileLabel}</span>
        </div>
      }
      actions={
        <>
          <SettingsButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </SettingsButton>
          <SettingsButton variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </SettingsButton>
        </>
      }
    />
  )
}
