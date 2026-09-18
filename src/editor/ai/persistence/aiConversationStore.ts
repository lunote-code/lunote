import type { AiChatMessage } from '../aiChatTypes'
import {
  flushPersistedAiConversation,
  loadPersistedAiConversation,
  persistAiConversation,
  schedulePersistedAiConversation,
} from './aiConversationPersistence'

const conversations = new Map<string, AiChatMessage[]>()
const hydrationTokens = new Map<string, number>()

export function getAiConversation(docKey: string | null): AiChatMessage[] {
  if (!docKey) return []
  return conversations.get(docKey) ?? []
}

export function setAiConversation(docKey: string | null, messages: AiChatMessage[]): void {
  if (!docKey) return
  if (messages.length === 0) {
    conversations.delete(docKey)
    void persistAiConversation(docKey, [])
    return
  }
  conversations.set(docKey, messages)
  schedulePersistedAiConversation(docKey, messages)
}

export function clearAiConversation(docKey: string | null): void {
  if (!docKey) return
  conversations.delete(docKey)
  void flushPersistedAiConversation(docKey).then(() => persistAiConversation(docKey, []))
}

export async function hydrateAiConversation(docKey: string | null): Promise<AiChatMessage[]> {
  if (!docKey) return []
  const token = (hydrationTokens.get(docKey) ?? 0) + 1
  hydrationTokens.set(docKey, token)
  const persisted = await loadPersistedAiConversation(docKey)
  if (hydrationTokens.get(docKey) !== token) return getAiConversation(docKey)
  conversations.set(docKey, persisted)
  return persisted
}

export async function flushAiConversation(docKey: string | null): Promise<void> {
  if (!docKey) return
  await flushPersistedAiConversation(docKey)
  const messages = conversations.get(docKey) ?? []
  await persistAiConversation(docKey, messages)
}

export function clearAllAiConversationMemory(): void {
  conversations.clear()
  hydrationTokens.clear()
}

export function resetAiConversationStoreForTests(): void {
  clearAllAiConversationMemory()
}
