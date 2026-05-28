import { useEffect } from 'react'

export type AlertDialogProps = {
  open: boolean
  title: string
  message: string
  okLabel: string
  onClose: () => void
}

export function AlertDialog({ open, title, message, okLabel, onClose }: AlertDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="about-modal-backdrop confirm-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="about-modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-icon confirm-modal-icon-info" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 8v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 id="alert-dialog-title" className="about-modal-title confirm-modal-title">
          {title}
        </h2>
        <p id="alert-dialog-desc" className="about-modal-desc confirm-modal-desc alert-modal-desc">
          {message}
        </p>
        <button type="button" className="about-modal-close confirm-modal-single-ok" onClick={onClose}>
          {okLabel}
        </button>
      </div>
    </div>
  )
}
