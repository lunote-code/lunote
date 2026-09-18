import { useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useFocusTrap } from '../../lib/useFocusTrap'
import { resolveOverlayPortalRoot } from '../../lib/overlayPortalRoot'
import { DialogDeleteIcon, DialogInfoIcon, DialogWarningIcon } from './dialogIcons'

export type DialogShellTone = 'default' | 'warning' | 'destructive'

export type DialogShellProps = {
  open: boolean
  title: string
  description: string
  titleId: string
  descId: string
  tone?: DialogShellTone
  role?: 'alertdialog' | 'dialog'
  showIcon?: boolean
  backdropClassName?: string
  panelClassName?: string
  descriptionClassName?: string
  onBackdropClick?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  onEscape?: () => void
  children?: ReactNode
  actions: ReactNode
  actionsClassName?: string
  /** When set, render inside this element instead of the global overlay root. */
  portalRoot?: HTMLElement | null
  panelDataTestId?: string
}

function tonePanelClass(tone: DialogShellTone): string {
  if (tone === 'destructive') return 'delete-modal'
  return `confirm-modal${tone === 'warning' ? ' confirm-modal-warning' : ''}`
}

function toneIconClass(tone: DialogShellTone): string {
  if (tone === 'destructive') return 'delete-modal-icon'
  return `confirm-modal-icon${tone === 'default' ? ' confirm-modal-icon-info' : ''}`
}

function ToneIcon({ tone }: { tone: DialogShellTone }) {
  if (tone === 'destructive') return <DialogDeleteIcon />
  if (tone === 'warning') return <DialogWarningIcon />
  return <DialogInfoIcon />
}

export function DialogShell({
  open,
  title,
  description,
  titleId,
  descId,
  tone = 'default',
  role = 'alertdialog',
  showIcon = true,
  backdropClassName = '',
  panelClassName = '',
  descriptionClassName = '',
  onBackdropClick,
  initialFocusRef,
  onEscape,
  children,
  actions,
  actionsClassName = 'rename-modal-actions confirm-modal-actions settings-inline-controls',
  portalRoot = null,
  panelDataTestId,
}: DialogShellProps) {
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)

  useFocusTrap(open, dialogEl, { initialFocusRef, onEscape })

  if (!open) return null

  const backdropToneClass = tone === 'destructive' ? 'delete-modal-backdrop' : 'confirm-modal-backdrop'

  const shell = (
    <div
      className={`about-modal-backdrop ${backdropToneClass} ${backdropClassName}`.trim()}
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        ref={setDialogEl}
        className={`about-modal ${tonePanelClass(tone)} ${panelClassName}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid={panelDataTestId}
        onClick={(event) => event.stopPropagation()}
      >
        {showIcon ? (
          <div className={toneIconClass(tone)} aria-hidden>
            <ToneIcon tone={tone} />
          </div>
        ) : null}
        <h2
          id={titleId}
          className={`about-modal-title ${tone === 'destructive' ? 'delete-modal-title' : 'confirm-modal-title'}`}
        >
          {title}
        </h2>
        <p
          id={descId}
          className={`about-modal-desc ${tone === 'destructive' ? 'delete-modal-desc' : 'confirm-modal-desc'} ${descriptionClassName}`.trim()}
        >
          {description}
        </p>
        {children}
        <div className={actionsClassName}>{actions}</div>
      </div>
    </div>
  )

  const mountTarget = portalRoot ?? resolveOverlayPortalRoot()
  return typeof document !== 'undefined' ? createPortal(shell, mountTarget) : shell
}
