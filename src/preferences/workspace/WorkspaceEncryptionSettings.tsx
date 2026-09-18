import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons/Icon'
import type { SemanticIconName } from '../../design-system/icons/iconRegistry'
import {
  SettingsButton,
  SettingsHelpPopover,
  SettingsInlineHelp,
  SettingsInput,
  SettingsGroup,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
  type SettingsSelectOption,
} from '../../components/settings'
import { PreferencesNotice } from '../PreferencesNotice'
import { pathsEqual } from '../../lib/workspacePathUtils'
import {
  getAppSettingsSnapshot,
  setSecurityAutoLockMinutes,
  subscribeAppSettings,
} from '../../settings/appSettingsStore'
import {
  AUTO_LOCK_MINUTE_OPTIONS,
  normalizeAutoLockMinutes,
} from '../../settings-runtime/workspaceAutoLock'
import {
  changeWorkspaceEncryptionPassword,
  enableWorkspaceEncryption,
  disableWorkspaceEncryption,
  unlockWorkspace,
  getWorkspaceEncryptionStatus,
  isIncorrectPasswordError,
  cancelWorkspaceEncryptionMigration,
  setWorkspaceEncryptImages,
  isWorkspaceMigrationCancelledError,
  WORKSPACE_ENCRYPTION_CHANGED_EVENT,
  WORKSPACE_ENCRYPTION_MIGRATION_PROGRESS_EVENT,
  type WorkspaceEncryptionMigrationProgress,
  type WorkspaceEncryptionStatus,
} from '../../platform/tauri/workspaceEncryptionService'
import { syncWorkspaceImageEncryptionFromStatus } from '../../workspace/workspaceImageEncryptionRuntime'

type Props = {
  t: TranslateFn
  rootDir: string
}

type EncryptionVisualState = 'off' | 'locked' | 'unlocked'

function resolveVisualState(status: WorkspaceEncryptionStatus | null): EncryptionVisualState {
  if (!status?.enabled) return 'off'
  return status.unlocked ? 'unlocked' : 'locked'
}

function EncryptionFormField({
  label,
  value,
  disabled,
  autoComplete,
  onChange,
  onEnter,
}: {
  label: string
  value: string
  disabled?: boolean
  autoComplete?: string
  onChange: (value: string) => void
  onEnter?: () => void
}) {
  return (
    <label className="workspace-encryption-field">
      <span className="workspace-encryption-field-label">{label}</span>
      <span className="workspace-encryption-field-input-wrap">
        <span className="workspace-encryption-field-input-icon" aria-hidden="true">
          <Icon name="encryption-key" size="sm" tone="muted" stroke="strong" />
        </span>
        <SettingsInput
          className="workspace-encryption-field-input"
          type="password"
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter?.()
          }}
        />
      </span>
    </label>
  )
}

function EncryptionActionCard({
  icon,
  title,
  helpBody,
  tone = 'default',
  children,
}: {
  icon: SemanticIconName
  title: string
  helpBody?: string
  tone?: 'default' | 'accent' | 'danger'
  children: ReactNode
}) {
  return (
    <section className={`workspace-encryption-action-card workspace-encryption-action-card--${tone}`}>
      <header className="workspace-encryption-action-card-header">
        <span className="workspace-encryption-action-card-icon" aria-hidden="true">
          <Icon name={icon} size="sm" tone={tone === 'danger' ? 'muted' : 'accent'} stroke="strong" />
        </span>
        {helpBody ? (
          <SettingsInlineHelp
            className="workspace-encryption-action-card-title-wrap"
            label={<span className="workspace-encryption-action-card-title">{title}</span>}
            help={<SettingsHelpPopover title={title} body={helpBody} />}
          />
        ) : (
          <h5 className="workspace-encryption-action-card-title">{title}</h5>
        )}
      </header>
      <div className="workspace-encryption-action-card-body">{children}</div>
    </section>
  )
}

function EncryptionStatusStrip({
  t,
  visualState,
}: {
  t: TranslateFn
  visualState: EncryptionVisualState
}) {
  const iconName: SemanticIconName =
    visualState === 'off' ? 'encryption-open' : visualState === 'locked' ? 'callout-warning' : 'encryption'
  const badgeKey =
    visualState === 'off'
      ? 'workspace.encryption.badge.off'
      : visualState === 'locked'
        ? 'workspace.encryption.badge.locked'
        : 'workspace.encryption.badge.unlocked'

  return (
    <div className="workspace-encryption-status-strip" data-state={visualState}>
      <span className="workspace-encryption-status-strip-icon" aria-hidden="true">
        <Icon
          name={iconName}
          size="sm"
          tone={visualState === 'unlocked' ? 'accent' : 'muted'}
          stroke="strong"
        />
      </span>
      <span className={`workspace-encryption-status-badge workspace-encryption-status-badge--${visualState}`}>
        {t(badgeKey)}
      </span>
      <SettingsInlineHelp
        className="workspace-encryption-status-strip-help"
        label={t('workspace.encryption.status.helpLabel')}
        help={
          <SettingsHelpPopover
            title={t('workspace.encryption.status.helpTitle')}
            body={t('workspace.encryption.passwordHint')}
          />
        }
      />
    </div>
  )
}

function FeedbackNotice({
  tone,
  icon,
  children,
}: {
  tone: 'status' | 'error'
  icon: SemanticIconName
  children: ReactNode
}) {
  return (
    <PreferencesNotice tone={tone} role={tone === 'error' ? 'alert' : 'status'} ariaLive="polite">
      <span className="workspace-encryption-feedback">
        <Icon name={icon} size="sm" tone={tone === 'error' ? 'muted' : 'accent'} stroke="strong" />
        <span>{children}</span>
      </span>
    </PreferencesNotice>
  )
}

function useAutoLockMinutes(): number {
  return useSyncExternalStore(
    subscribeAppSettings,
    () => normalizeAutoLockMinutes(getAppSettingsSnapshot().security?.autoLockMinutes),
    () => normalizeAutoLockMinutes(5),
  )
}

export function WorkspaceEncryptionSettings({ t, rootDir }: Props) {
  const autoLockMinutes = useAutoLockMinutes()
  const autoLockOptions = useMemo<SettingsSelectOption<string>[]>(
    () =>
      AUTO_LOCK_MINUTE_OPTIONS.map((minutes) => ({
        value: String(minutes),
        label: t(
          minutes === 0
            ? 'workspace.encryption.autoLock.option.off'
            : `workspace.encryption.autoLock.option.${minutes}`,
        ),
      })),
    [t],
  )
  const [status, setStatus] = useState<WorkspaceEncryptionStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [removePassword, setRemovePassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [migrationProgress, setMigrationProgress] = useState<{
    phase: string
    processed: number
    total: number
  } | null>(null)

  const refreshStatus = useCallback(async () => {
    if (!rootDir.trim()) {
      setStatus(null)
      return
    }
    try {
      const next = await getWorkspaceEncryptionStatus(rootDir)
      setStatus(next)
      syncWorkspaceImageEncryptionFromStatus(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [rootDir])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (!rootDir.trim()) return
    const onEncryptionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ root?: string }>).detail
      if (detail?.root && !pathsEqual(detail.root, rootDir)) return
      void refreshStatus()
    }
    window.addEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
    return () => window.removeEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
  }, [refreshStatus, rootDir])

  useEffect(() => {
    if (!rootDir.trim() || !isTauri()) return
    let disposed = false
    let unlisten: (() => void) | undefined

    void listen<WorkspaceEncryptionMigrationProgress>(
      WORKSPACE_ENCRYPTION_MIGRATION_PROGRESS_EVENT,
      (event) => {
        if (disposed || event.payload.root !== rootDir) return
        setMigrationProgress({
          phase: event.payload.phase,
          processed: event.payload.processed,
          total: event.payload.total,
        })
      },
    ).then((fn) => {
      if (disposed) {
        fn()
        return
      }
      unlisten = fn
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [rootDir])

  const resetFields = () => {
    setPassword('')
    setConfirmPassword('')
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setRemovePassword('')
    setUnlockPassword('')
    setConfirmRemove(false)
  }

  const runAction = async (action: () => Promise<void>, successKey?: string) => {
    setBusy(true)
    setError(null)
    setSuccessMessage(null)
    setMigrationProgress(null)
    try {
      await action()
      resetFields()
      await refreshStatus()
      if (successKey) setSuccessMessage(t(successKey))
    } catch (e) {
      setError(
        isWorkspaceMigrationCancelledError(e)
          ? t('workspace.encryption.migration.cancelled')
          : isIncorrectPasswordError(e)
            ? t('workspace.encryption.error.incorrectPassword')
            : e instanceof Error
              ? e.message
              : String(e),
      )
    } finally {
      setMigrationProgress(null)
      setBusy(false)
    }
  }

  if (!rootDir.trim()) {
    return (
      <PreferencesNotice tone="muted">{t('workspace.encryption.noWorkspace')}</PreferencesNotice>
    )
  }

  const visualState = resolveVisualState(status)
  const enabled = status?.enabled ?? false
  const passwordsMatch = password === confirmPassword
  const newPasswordsMatch = newPassword === newPasswordConfirm
  const migrationPhaseLabel =
    migrationProgress?.phase === 'decrypting'
      ? t('workspace.encryption.migration.phase.disable')
      : migrationProgress?.phase === 'reencrypting'
        ? t('workspace.encryption.migration.phase.changePassword')
        : t('workspace.encryption.migration.phase.enable')
  const migrationPercent =
    migrationProgress && migrationProgress.total > 0
      ? Math.min(100, Math.round((migrationProgress.processed / migrationProgress.total) * 100))
      : 0

  return (
    <div className="workspace-encryption-panel">
      <EncryptionStatusStrip t={t} visualState={visualState} />

      <SettingsGroup>
        {visualState === 'unlocked' ? (
          <SettingsRow
            label={t('workspace.encryption.encryptImages.label')}
            description={t('workspace.encryption.encryptImages.description')}
          >
            <SettingsSwitch
              checked={Boolean(status?.encryptImages)}
              disabled={busy || migrationProgress != null}
              ariaLabel={t('workspace.encryption.encryptImages.label')}
              onCheckedChange={(checked) => {
                if (!status?.enabled || visualState !== 'unlocked') return
                void (async () => {
                  setBusy(true)
                  setError(null)
                  setSuccessMessage(null)
                  try {
                    await setWorkspaceEncryptImages(rootDir, checked)
                    await refreshStatus()
                    setSuccessMessage(t('workspace.encryption.encryptImages.saved'))
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            />
          </SettingsRow>
        ) : null}

        <SettingsRow
          label={
            <SettingsInlineHelp
              label={t('workspace.encryption.autoLock.label')}
              help={
                <SettingsHelpPopover
                  title={t('workspace.encryption.autoLock.label')}
                  body={t('workspace.encryption.autoLock.description')}
                />
              }
            />
          }
        >
          <SettingsSelect
            value={String(autoLockMinutes)}
            options={autoLockOptions}
            ariaLabel={t('workspace.encryption.autoLock.label')}
            disabled={busy}
            onValueChange={(value) => {
              void setSecurityAutoLockMinutes(Number.parseInt(value, 10))
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      {busy && migrationProgress && migrationProgress.total > 0 ? (
        <div className="workspace-encryption-migration-progress" role="status" aria-live="polite">
          <div className="workspace-encryption-migration-progress-header">
            <span>{migrationPhaseLabel}</span>
            <span>
              {t('workspace.encryption.migration.progress', {
                processed: migrationProgress.processed,
                total: migrationProgress.total,
              })}
            </span>
          </div>
          <div
            className="workspace-encryption-migration-progress-bar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={migrationPercent}
            role="progressbar"
          >
            <div
              className="workspace-encryption-migration-progress-bar-fill"
              style={{ width: `${migrationPercent}%` }}
            />
          </div>
          <div className="workspace-encryption-migration-progress-actions">
            <SettingsButton
              variant="secondary"
              disabled={!busy}
              onClick={() => {
                void cancelWorkspaceEncryptionMigration(rootDir).catch((error) => {
                  setError(error instanceof Error ? error.message : String(error))
                })
              }}
            >
              {t('workspace.encryption.migration.cancel')}
            </SettingsButton>
          </div>
        </div>
      ) : null}

      {!enabled ? (
        <EncryptionActionCard
          icon="encryption"
          title={t('workspace.encryption.enable.title')}
          helpBody={t('workspace.encryption.enable.lead')}
          tone="accent"
        >
          <div className="workspace-encryption-form">
            <EncryptionFormField
              label={t('workspace.encryption.password')}
              value={password}
              disabled={busy}
              autoComplete="new-password"
              onChange={setPassword}
            />
            <EncryptionFormField
              label={t('workspace.encryption.confirmPassword')}
              value={confirmPassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={setConfirmPassword}
              onEnter={() => {
                if (!busy && password.trim() && passwordsMatch) {
                  void runAction(async () => {
                    await enableWorkspaceEncryption(rootDir, password)
                  }, 'workspace.encryption.enable.success')
                }
              }}
            />
            {confirmPassword && !passwordsMatch ? (
              <p className="workspace-encryption-field-hint workspace-encryption-field-hint--error" role="alert">
                {t('workspace.encryption.error.passwordMismatch')}
              </p>
            ) : null}
            <div className="workspace-encryption-form-actions">
              <SettingsButton
                type="button"
                variant="primary"
                disabled={busy || !password.trim() || !passwordsMatch}
                onClick={() =>
                  void runAction(async () => {
                    await enableWorkspaceEncryption(rootDir, password)
                  }, 'workspace.encryption.enable.success')
                }
              >
                <span className="workspace-encryption-action-label">
                  <Icon name="encryption" size="sm" stroke="strong" />
                  {t('workspace.encryption.enable')}
                </span>
              </SettingsButton>
            </div>
          </div>
        </EncryptionActionCard>
      ) : (
        <>
          {visualState === 'locked' ? (
            <EncryptionActionCard
              icon="encryption"
              title={t('workspace.encryption.unlock.title')}
              helpBody={t('workspace.encryption.unlock.message')}
              tone="accent"
            >
              <div className="workspace-encryption-form">
                <EncryptionFormField
                  label={t('workspace.encryption.password')}
                  value={unlockPassword}
                  disabled={busy}
                  autoComplete="current-password"
                  onChange={setUnlockPassword}
                  onEnter={() => {
                    if (!busy && unlockPassword.trim()) {
                      void runAction(async () => {
                        await unlockWorkspace(rootDir, unlockPassword)
                      })
                    }
                  }}
                />
                <div className="workspace-encryption-form-actions">
                  <SettingsButton
                    type="button"
                    variant="primary"
                    disabled={busy || !unlockPassword.trim()}
                    onClick={() =>
                      void runAction(async () => {
                        await unlockWorkspace(rootDir, unlockPassword)
                      })
                    }
                  >
                    <span className="workspace-encryption-action-label">
                      <Icon name="encryption-open" size="sm" stroke="strong" />
                      {t('workspace.encryption.unlock.confirm')}
                    </span>
                  </SettingsButton>
                </div>
              </div>
            </EncryptionActionCard>
          ) : null}

          <div className="workspace-encryption-actions-grid">
          <EncryptionActionCard
            icon="encryption-key"
            title={t('workspace.encryption.changePassword')}
            helpBody={t('workspace.encryption.changePasswordHint')}
          >
            <div className="workspace-encryption-form">
              <EncryptionFormField
                label={t('workspace.encryption.currentPassword')}
                value={currentPassword}
                disabled={busy}
                autoComplete="current-password"
                onChange={setCurrentPassword}
              />
              <EncryptionFormField
                label={t('workspace.encryption.newPassword')}
                value={newPassword}
                disabled={busy}
                autoComplete="new-password"
                onChange={setNewPassword}
              />
              <EncryptionFormField
                label={t('workspace.encryption.confirmNewPassword')}
                value={newPasswordConfirm}
                disabled={busy}
                autoComplete="new-password"
                onChange={setNewPasswordConfirm}
                onEnter={() => {
                  if (!busy && currentPassword.trim() && newPassword.trim() && newPasswordsMatch) {
                    void runAction(async () => {
                      await changeWorkspaceEncryptionPassword(rootDir, currentPassword, newPassword)
                    }, 'workspace.encryption.changePasswordSuccess')
                  }
                }}
              />
              {newPasswordConfirm && !newPasswordsMatch ? (
                <p className="workspace-encryption-field-hint workspace-encryption-field-hint--error" role="alert">
                  {t('workspace.encryption.error.passwordMismatch')}
                </p>
              ) : null}
              <div className="workspace-encryption-form-actions">
                <SettingsButton
                  type="button"
                  variant="secondary"
                  disabled={
                    busy ||
                    !currentPassword.trim() ||
                    !newPassword.trim() ||
                    !newPasswordsMatch
                  }
                  onClick={() =>
                    void runAction(async () => {
                      await changeWorkspaceEncryptionPassword(rootDir, currentPassword, newPassword)
                    }, 'workspace.encryption.changePasswordSuccess')
                  }
                >
                  {t('workspace.encryption.changePassword')}
                </SettingsButton>
              </div>
            </div>
          </EncryptionActionCard>

          <EncryptionActionCard
            icon="encryption-open"
            title={t('workspace.encryption.remove.title')}
            helpBody={`${t('workspace.encryption.remove.description')} ${t('workspace.encryption.remove.warning')}`}
            tone="danger"
          >
            <div className="workspace-encryption-form">
              <EncryptionFormField
                label={t('workspace.encryption.currentPassword')}
                value={removePassword}
                disabled={busy}
                autoComplete="current-password"
                onChange={(value) => {
                  setRemovePassword(value)
                  setConfirmRemove(false)
                }}
              />
              {confirmRemove ? (
                <div className="workspace-encryption-remove-confirm" role="status">
                  <Icon name="callout-warning" size="sm" tone="muted" stroke="strong" />
                  <span>{t('workspace.encryption.remove.warning')}</span>
                </div>
              ) : null}
              <div className="workspace-encryption-form-actions">
                {confirmRemove ? (
                  <>
                    <SettingsButton
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setConfirmRemove(false)}
                    >
                      {t('app.rename.cancel')}
                    </SettingsButton>
                    <SettingsButton
                      type="button"
                      variant="primary"
                      disabled={busy || !removePassword.trim()}
                      onClick={() =>
                        void runAction(async () => {
                          await disableWorkspaceEncryption(rootDir, removePassword)
                        }, 'workspace.encryption.remove.success')
                      }
                    >
                      {t('workspace.encryption.remove.confirm')}
                    </SettingsButton>
                  </>
                ) : (
                  <SettingsButton
                    type="button"
                    variant="secondary"
                    disabled={busy || !removePassword.trim()}
                    onClick={() => setConfirmRemove(true)}
                  >
                    {t('workspace.encryption.remove.action')}
                  </SettingsButton>
                )}
              </div>
            </div>
          </EncryptionActionCard>
        </div>
        </>
      )}

      {successMessage ? (
        <FeedbackNotice tone="status" icon="callout-success">
          {successMessage}
        </FeedbackNotice>
      ) : null}

      {error ? (
        <FeedbackNotice tone="error" icon="callout-warning">
          {error}
        </FeedbackNotice>
      ) : null}
    </div>
  )
}
