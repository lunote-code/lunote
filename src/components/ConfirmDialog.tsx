import { useRef, type ReactNode } from 'react'

import { DialogShell } from './dialog/DialogShell'
import { SettingsButton } from './settings'

export type ConfirmDialogVariant = 'default' | 'warning'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant?: ConfirmDialogVariant
  children?: ReactNode
  panelClassName?: string
  backdropClassName?: string
  portalRoot?: HTMLElement | null
  panelDataTestId?: string
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
  children,
  panelClassName,
  backdropClassName,
  portalRoot,
  panelDataTestId,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <DialogShell
      open={open}
      title={title}
      description={message}
      titleId="confirm-dialog-title"
      descId="confirm-dialog-desc"
      tone={variant === 'warning' ? 'warning' : 'default'}
      panelClassName={panelClassName}
      backdropClassName={backdropClassName}
      portalRoot={portalRoot}
      panelDataTestId={panelDataTestId}
      initialFocusRef={cancelButtonRef}
      onEscape={onCancel}
      children={children}
      actions={
        <>
          <SettingsButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </SettingsButton>
          <SettingsButton variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </SettingsButton>
        </>
      }
    />
  )
}
