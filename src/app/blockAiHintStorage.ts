export const BLOCK_AI_DISCOVER_HINT_STORAGE_KEY = 'luna.blockAi.hintSeen'

export function isBlockAiDiscoverHintSeen(): boolean {
  try {
    return localStorage.getItem(BLOCK_AI_DISCOVER_HINT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markBlockAiDiscoverHintSeen(): void {
  try {
    localStorage.setItem(BLOCK_AI_DISCOVER_HINT_STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}
