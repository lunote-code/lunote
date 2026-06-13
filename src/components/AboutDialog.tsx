import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { SettingsButton } from './settings'
import type { TranslateFn } from '../i18n'
import { APP_DISPLAY_NAME, APP_SHORT_NAME, APP_VERSION } from '../app/workspace/constants'
import {
  checkForAppUpdate,
  openAppReleasePage,
  type AppUpdateCheckResult,
} from '../update/appUpdate'
import { useFocusTrap } from '../lib/useFocusTrap'

type Props = {
  open: boolean
  onClose: () => void
  t: TranslateFn
}

export function AboutDialog({ open, onClose, t }: Props) {
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useFocusTrap(open, dialogRef.current, { initialFocus: closeButtonRef.current, onEscape: onClose })

  useEffect(() => {
    if (!open) {
      setUpdateResult(null)
      return
    }
    let cancelled = false
    void (async () => {
      const result = await checkForAppUpdate()
      if (!cancelled) setUpdateResult(result)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const releaseUrl =
    updateResult?.status === 'update-available' ? updateResult.releaseUrl : undefined

  const renderUpdateStatus = () => {
    if (updateResult == null) {
      return (
        <p className="about-modal-update-status about-modal-update-status--checking">
          {t('app.about.update.checking')}
        </p>
      )
    }
    if (updateResult.status === 'error') {
      return (
        <p className="about-modal-update-status about-modal-update-status--error">
          {t('app.about.update.checkFailed')}
        </p>
      )
    }
    if (updateResult.status === 'update-available') {
      return (
        <p className="about-modal-update-status about-modal-update-status--available">
          {t('app.about.update.available', { version: updateResult.latestVersion })}
        </p>
      )
    }
    return (
      <p className="about-modal-update-status about-modal-update-status--latest">
        {t('app.about.update.latest')}
      </p>
    )
  }

  return (
    <AboutDialogBackdrop onClose={onClose}>
      <div
        ref={dialogRef}
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="about-title" className="about-modal-title">
          {APP_DISPLAY_NAME}
        </h2>
        <p className="about-modal-version">
          {t('app.about.title', { name: APP_SHORT_NAME, version: APP_VERSION })}
        </p>
        {renderUpdateStatus()}
        <p className="about-modal-desc">{t('app.about.desc')}</p>
        <AboutDialogActions releaseUrl={releaseUrl} onClose={onClose} t={t} closeButtonRef={closeButtonRef} />
      </div>
    </AboutDialogBackdrop>
  )
}

function AboutDialogBackdrop({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="about-modal-backdrop" role="presentation" onClick={onClose}>
      {children}
    </div>
  )
}

function AboutDialogActions({
  releaseUrl,
  onClose,
  t,
  closeButtonRef,
}: {
  releaseUrl: string | undefined
  onClose: () => void
  t: TranslateFn
  closeButtonRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <div className="about-modal-actions settings-stack">
      {releaseUrl ? (
        <SettingsButton variant="primary" onClick={() => void openAppReleasePage(releaseUrl)}>
          {t('app.about.update.download')}
        </SettingsButton>
      ) : null}
      <SettingsButton ref={closeButtonRef} variant="secondary" onClick={onClose}>
        {t('app.about.close')}
      </SettingsButton>
    </div>
  )
}
