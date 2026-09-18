import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SettingsButton } from '../../../components/settings'
import { useImeCompositionGuard } from '../../../lib/keyboardIme'
import { resolveOverlayPortalRoot } from '../../../lib/overlayPortalRoot'
import { useFocusTrap } from '../../../lib/useFocusTrap'

type GraphPresetSaveDialogProps = {
  open: boolean
  title: string
  label: string
  saveLabel: string
  cancelLabel: string
  saveError?: string | null
  onClose: () => void
  onSave: (name: string) => void
}

export function GraphPresetSaveDialog({
  open,
  title,
  label,
  saveLabel,
  cancelLabel,
  saveError = null,
  onClose,
  onSave,
}: GraphPresetSaveDialogProps) {
  const [name, setName] = useState('')
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const ime = useImeCompositionGuard()

  useFocusTrap(open, dialogRef.current, {
    initialFocusRef: inputRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (open) setName('')
  }, [open])

  if (!open) return null

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return createPortal(
    <div
      className="about-modal-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="kos-graph-preset-save-dialog"
    >
      <div
        ref={dialogRef}
        className="about-modal rename-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="about-modal-title">
          {title}
        </h2>
        <label className="rename-modal-field">
          <span className="rename-modal-field-label">{label}</span>
          <input
            ref={inputRef}
            className="rename-modal-input"
            value={name}
            data-testid="kos-graph-preset-name-input"
            onChange={(event) => setName(event.target.value)}
            onCompositionStart={ime.onCompositionStart}
            onCompositionEnd={ime.onCompositionEnd}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (ime.shouldIgnoreEnter(event)) return
                submit()
              }
              if (event.key === 'Escape') {
                event.stopPropagation()
                onClose()
              }
            }}
          />
        </label>
        {saveError ? <p className="rename-modal-error">{saveError}</p> : null}
        <div className="rename-modal-actions">
          <SettingsButton variant="secondary" onClick={onClose}>
            {cancelLabel}
          </SettingsButton>
          <SettingsButton
            variant="primary"
            disabled={!name.trim()}
            data-testid="kos-graph-preset-name-save"
            onClick={submit}
          >
            {saveLabel}
          </SettingsButton>
        </div>
      </div>
    </div>,
    resolveOverlayPortalRoot(),
  )
}
