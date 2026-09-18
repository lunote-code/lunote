import type { TranslateFn } from '../../i18n'
import { ConfirmDialog } from '../../components/ConfirmDialog'

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
  const title = isUpdate
    ? t('settings.plugins.confirmUpdateTitle', { name: pluginName })
    : t('settings.plugins.confirmInstallTitle', { name: pluginName })

  const message = isUpdate
    ? t('settings.plugins.confirmUpdateMessage', { name: pluginName, version })
    : t('settings.plugins.confirmInstallMessage', { name: pluginName, version })

  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={isUpdate ? t('settings.plugins.update') : t('settings.plugins.confirmInstall')}
      cancelLabel={t('settings.plugins.confirmCancel')}
      panelClassName="prefs-plugin-confirm-dialog"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {permissionLabels.length > 0 ? (
        <div className="prefs-plugin-confirm-permissions">
          <p className="prefs-plugin-confirm-permissions-title">
            {t('settings.plugins.confirmPermissionsLead')}
          </p>
          <ul className="prefs-plugin-detail-list">
            {permissionLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </ConfirmDialog>
  )
}
