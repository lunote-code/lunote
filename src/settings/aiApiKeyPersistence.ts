import { isTauri } from '@tauri-apps/api/core'

import type { AppSettingsState } from './appSettingsTypes'
import {
  deleteAiApiKeyFromKeychain,
  getAiApiKeyFromKeychain,
  setAiApiKeyInKeychain,
} from '../platform/tauri/aiSecretsService'

/** Strip API key before writing settings JSON / local mirror on Tauri. */
export function stripAiApiKeyForDisk(settings: AppSettingsState): AppSettingsState {
  return {
    ...settings,
    ai: {
      ...(settings.ai ?? {}),
      apiKey: '',
    },
  }
}

/**
 * Hydrate AI API key from the OS keychain into the in-memory settings snapshot.
 * Migrates any legacy plaintext `settings.ai.apiKey` into the keychain.
 */
export async function hydrateAiApiKeyFromSecureStore(
  settings: AppSettingsState,
): Promise<{ settings: AppSettingsState; didMigrateFromSettings: boolean }> {
  if (!isTauri()) return { settings, didMigrateFromSettings: false }

  const settingsKey = typeof settings.ai?.apiKey === 'string' ? settings.ai.apiKey.trim() : ''
  let keyFromKeychain = ''
  try {
    keyFromKeychain = (await getAiApiKeyFromKeychain())?.trim() ?? ''
  } catch (error) {
    console.warn('[ai-api-key] Failed to read keychain', error)
  }

  let didMigrateFromSettings = false
  if (settingsKey && !keyFromKeychain) {
    try {
      await setAiApiKeyInKeychain(settingsKey)
      keyFromKeychain = settingsKey
      didMigrateFromSettings = true
    } catch (error) {
      console.warn('[ai-api-key] Failed to migrate plaintext key into keychain', error)
      // Keep plaintext in memory so the user does not lose a working key.
      return { settings, didMigrateFromSettings: false }
    }
  } else if (settingsKey) {
    // Keychain already has a value — clear legacy plaintext from disk on next save.
    didMigrateFromSettings = true
  }

  const runtimeKey = keyFromKeychain || settingsKey
  return {
    settings: {
      ...settings,
      ai: {
        ...(settings.ai ?? {}),
        apiKey: runtimeKey,
      },
    },
    didMigrateFromSettings,
  }
}

/** Persist (or clear) the AI API key in the OS keychain. */
export async function persistAiApiKeyToSecureStore(apiKey: string): Promise<void> {
  if (!isTauri()) return
  const trimmed = apiKey.trim()
  if (!trimmed) {
    await deleteAiApiKeyFromKeychain()
    return
  }
  await setAiApiKeyInKeychain(trimmed)
}
