import { useEffect } from 'react'

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
      className="about-modal-backdrop delete-modal-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="about-modal delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-modal-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </div>
        <h2 id="delete-confirm-title" className="about-modal-title delete-modal-title">
          {title}
        </h2>
        <p id="delete-confirm-desc" className="about-modal-desc delete-modal-desc">
          {message}
        </p>
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
        <div className="rename-modal-actions delete-modal-actions">
          <button type="button" className="about-modal-close rename-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="about-modal-close delete-modal-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
