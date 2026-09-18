import type { TranslateFn } from '../i18n'
import { SettingsPage } from '../components/settings'
import { PREFS_TAB_DESCRIPTION_KEY, PREFS_TAB_TITLE_KEY } from './prefsMeta'
import { WorkspaceEncryptionSettings } from './workspace/WorkspaceEncryptionSettings'

type Props = {
  t: TranslateFn
  workspaceRoot?: string
}

export function WorkspaceEncryptionPreferencesPanel({ t, workspaceRoot = '' }: Props) {
  return (
    <SettingsPage
      title={t(PREFS_TAB_TITLE_KEY.encryption)}
      description={t(PREFS_TAB_DESCRIPTION_KEY.encryption)}
      className="settings-page--prefs-encryption"
    >
      <WorkspaceEncryptionSettings t={t} rootDir={workspaceRoot} />
    </SettingsPage>
  )
}
