import { useEffect } from 'react'

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
 * The visual is the same as ConfirmDialog (warning), with only one more secondary operation button.
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
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="about-modal-backdrop confirm-modal-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="about-modal confirm-modal confirm-modal-warning"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="unsaved-dialog-title" className="about-modal-title confirm-modal-title">
          {title}
        </h2>
        <p id="unsaved-dialog-desc" className="about-modal-desc confirm-modal-desc">
          {message}
        </p>
        <div className="confirm-modal-actions confirm-modal-actions-multi">
          <button type="button" className="about-modal-close rename-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="about-modal-close rename-modal-cancel" onClick={onDiscard}>
            {discardLabel}
          </button>
          <button
            type="button"
            className="about-modal-close confirm-modal-confirm confirm-modal-confirm-warning"
            onClick={onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
