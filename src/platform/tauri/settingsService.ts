import { invoke } from '@tauri-apps/api/core'

import type { AppSettingsState } from '../../settings/appSettingsTypes'

export async function getAppSettings(): Promise<AppSettingsState> {
  return invoke<AppSettingsState>('get_app_settings')
}

export async function saveAppSettings(settings: AppSettingsState): Promise<void> {
  await invoke('save_app_settings', { settings })
}
