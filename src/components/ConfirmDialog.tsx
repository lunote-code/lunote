import { useEffect } from 'react'

export type ConfirmDialogVariant = 'default' | 'warning'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant?: ConfirmDialogVariant
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
        className={`about-modal confirm-modal confirm-modal-${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-icon" aria-hidden>
          {variant === 'warning' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 8v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" />
            </svg>
          )}
        </div>
        <h2 id="confirm-dialog-title" className="about-modal-title confirm-modal-title">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="about-modal-desc confirm-modal-desc">
          {message}
        </p>
        <div className="rename-modal-actions confirm-modal-actions">
          <button type="button" className="about-modal-close rename-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`about-modal-close confirm-modal-confirm confirm-modal-confirm-${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
