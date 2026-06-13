import { useRef, useState } from 'react'

import { SettingsButton } from '../../components/settings'
import { useFocusTrap } from '../../lib/useFocusTrap'
import type { TranslateFn } from '../../i18n'

type Props = {
  open: boolean
  pluginName: string
  version: string
  isUpdate: boolean
  permissionLabels: string[]
  t: TranslateFn
  onConfirm: () => void
  onCancel: () => void
}

export function PluginInstallConfirmDialog({
  open,
  pluginName,
  version,
  isUpdate,
  permissionLabels,
  t,
  onConfirm,
  onCancel,
}: Props) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)

  useFocusTrap(open, dialogEl, { initialFocusRef: cancelButtonRef, onEscape: onCancel })

  if (!open) return null

  const title = isUpdate
    ? t('settings.plugins.confirmUpdateTitle', { name: pluginName })
    : t('settings.plugins.confirmInstallTitle', { name: pluginName })

  return (
    <div className="about-modal-backdrop confirm-modal-backdrop prefs-plugin-confirm-backdrop" role="presentation">
      <div
        ref={setDialogEl}
        className="about-modal confirm-modal prefs-plugin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="plugin-install-confirm-title"
        aria-describedby="plugin-install-confirm-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="plugin-install-confirm-title" className="about-modal-title confirm-modal-title">
          {title}
        </h2>
        <p id="plugin-install-confirm-desc" className="about-modal-desc confirm-modal-desc">
          {isUpdate
            ? t('settings.plugins.confirmUpdateMessage', { name: pluginName, version })
            : t('settings.plugins.confirmInstallMessage', { name: pluginName, version })}
        </p>

        {permissionLabels.length > 0 ? (
          <div className="prefs-plugin-confirm-permissions">
            <p className="prefs-plugin-confirm-permissions-title">{t('settings.plugins.confirmPermissionsLead')}</p>
            <ul className="prefs-plugin-detail-list">
              {permissionLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rename-modal-actions confirm-modal-actions settings-inline-controls">
          <SettingsButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {t('settings.plugins.confirmCancel')}
          </SettingsButton>
          <SettingsButton variant="primary" onClick={onConfirm}>
            {isUpdate ? t('settings.plugins.update') : t('settings.plugins.confirmInstall')}
          </SettingsButton>
        </div>
      </div>
    </div>
  )
}
