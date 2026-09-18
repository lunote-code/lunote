import { invoke } from '@tauri-apps/api/core'

export async function getAiApiKeyFromKeychain(): Promise<string | null> {
  return invoke<string | null>('get_ai_api_key')
}

export async function setAiApiKeyInKeychain(key: string): Promise<void> {
  await invoke('set_ai_api_key', { key })
}

export async function deleteAiApiKeyFromKeychain(): Promise<void> {
  await invoke('delete_ai_api_key')
}

export async function hasAiApiKeyInKeychain(): Promise<boolean> {
  return invoke<boolean>('has_ai_api_key')
}
