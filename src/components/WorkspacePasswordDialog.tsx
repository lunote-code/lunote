import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../design-system/icons/Icon'
import { useFocusTrap } from '../lib/useFocusTrap'
import { resolveOverlayPortalRoot } from '../lib/overlayPortalRoot'
import { SettingsButton } from './settings'

export type WorkspacePasswordDialogProps = {
  open: boolean
  title: string
  message: string
  passwordLabel?: string
  confirmLabel: string
  cancelLabel: string
  requireConfirm?: boolean
  confirmPasswordLabel?: string
  error?: string | null
  onSubmit: (password: string, confirmPassword?: string) => void
  onCancel: () => void
}

export function WorkspacePasswordDialog({
  open,
  title,
  message,
  passwordLabel = '',
  confirmLabel,
  cancelLabel,
  requireConfirm = false,
  confirmPasswordLabel = '',
  error = null,
  onSubmit,
  onCancel,
}: WorkspacePasswordDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useFocusTrap(open, dialogRef.current, {
    initialFocusRef: passwordRef,
    onEscape: onCancel,
  })

  useEffect(() => {
    if (!open) {
      setPassword('')
      setConfirmPassword('')
      setLocalError(null)
      return
    }
    const timer = window.setTimeout(() => passwordRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    setLocalError(error)
  }, [error, open])

  const canSubmit =
    password.trim().length > 0 && (!requireConfirm || (confirmPassword.trim().length > 0 && password === confirmPassword))

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(password, requireConfirm ? confirmPassword : undefined)
  }

  if (!open) return null

  const shell = (
    <div
      className="about-modal-backdrop confirm-modal-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="about-modal workspace-password-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="workspace-password-dialog-title"
        aria-describedby="workspace-password-dialog-desc"
        data-testid="workspace-password-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-password-modal-icon" aria-hidden="true">
          <Icon name="encryption" size="lg" tone="accent" stroke="strong" />
        </div>

        <h2 id="workspace-password-dialog-title" className="workspace-password-modal-title">
          {title}
        </h2>
        <p id="workspace-password-dialog-desc" className="workspace-password-modal-desc">
          {message}
        </p>

        <div className="workspace-password-modal-form">
          <label className="workspace-password-modal-field">
            {passwordLabel ? (
              <span className="workspace-password-modal-field-label">{passwordLabel}</span>
            ) : null}
            <div className="workspace-password-modal-input-wrap">
              <span className="workspace-password-modal-input-icon" aria-hidden="true">
                <Icon name="encryption-key" size="sm" tone="muted" stroke="strong" />
              </span>
              <input
                ref={passwordRef}
                className="workspace-password-modal-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setLocalError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSubmit()
                }}
              />
            </div>
          </label>

          {requireConfirm ? (
            <label className="workspace-password-modal-field">
              <span className="workspace-password-modal-field-label">{confirmPasswordLabel}</span>
              <div className="workspace-password-modal-input-wrap">
                <span className="workspace-password-modal-input-icon" aria-hidden="true">
                  <Icon name="encryption-key" size="sm" tone="muted" stroke="strong" />
                </span>
                <input
                  className="workspace-password-modal-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setLocalError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSubmit()
                  }}
                />
              </div>
            </label>
          ) : null}

          {localError?.trim() ? (
            <div className="workspace-password-modal-error" role="alert">
              <Icon name="callout-warning" size="sm" tone="muted" stroke="strong" />
              <span>{localError}</span>
            </div>
          ) : null}
        </div>

        <div className="workspace-password-modal-actions">
          <SettingsButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </SettingsButton>
          <SettingsButton variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            <span className="workspace-password-modal-confirm-label">
              <Icon name="encryption-open" size="sm" stroke="strong" />
              {confirmLabel}
            </span>
          </SettingsButton>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(shell, resolveOverlayPortalRoot()) : shell
}
