import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import type { AiChatMessage } from '../aiChatTypes'

export const AI_CONVERSATION_STORE_VERSION = 1

export const AI_CONVERSATION_MAX_STORED_MESSAGES = 50

export type AiConversationSnapshot = {
  version: number
  docKey: string
  updatedAt: number
  messages: AiChatMessage[]
}

const WEB_STORAGE_PREFIX = 'Lunote:aiConversation:v1:'

const pendingSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

const pendingSaveMessages = new Map<string, AiChatMessage[]>()

const SAVE_DEBOUNCE_MS = 500

function webStorageKey(docKey: string): string {
  return `${WEB_STORAGE_PREFIX}${docKey}`
}

export function capAiConversationMessages(messages: AiChatMessage[]): AiChatMessage[] {
  if (messages.length <= AI_CONVERSATION_MAX_STORED_MESSAGES) return messages
  return messages.slice(-AI_CONVERSATION_MAX_STORED_MESSAGES)
}

export function sanitizeAiConversationMessages(messages: AiChatMessage[]): AiChatMessage[] {
  return messages.filter((message) => message.content.trim().length > 0)
}

export function serializeAiConversationSnapshot(
  docKey: string,
  messages: AiChatMessage[],
): AiConversationSnapshot {
  return {
    version: AI_CONVERSATION_STORE_VERSION,
    docKey,
    updatedAt: Date.now(),
    messages: capAiConversationMessages(sanitizeAiConversationMessages(messages)),
  }
}

export function parseAiConversationSnapshot(raw: unknown): AiChatMessage[] {
  if (!raw || typeof raw !== 'object') return []
  const snapshot = raw as Partial<AiConversationSnapshot>
  if (snapshot.version !== AI_CONVERSATION_STORE_VERSION) return []
  if (!Array.isArray(snapshot.messages)) return []

  const parsed: AiChatMessage[] = []
  for (const item of snapshot.messages) {
    if (!item || typeof item !== 'object') continue
    const message = item as Partial<AiChatMessage>
    if (message.role !== 'user' && message.role !== 'assistant') continue
    if (typeof message.content !== 'string') continue
    if (typeof message.id !== 'string' || !message.id) continue
    parsed.push({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
      ...(message.actionId ? { actionId: message.actionId } : {}),
      ...(message.autoApply ? { autoApply: message.autoApply } : {}),
      ...(Array.isArray(message.grammarIssues) ? { grammarIssues: message.grammarIssues } : {}),
      ...(message.grammarIssuesFailed ? { grammarIssuesFailed: true } : {}),
    })
  }
  return capAiConversationMessages(parsed)
}

async function readFromDisk(docKey: string): Promise<AiChatMessage[]> {
  try {
    const raw = await invoke<unknown | null>('read_ai_conversation', {
      payload: { docKey },
    })
    if (!raw) return []
    return parseAiConversationSnapshot(raw)
  } catch {
    return []
  }
}

async function writeToDisk(docKey: string, messages: AiChatMessage[]): Promise<void> {
  const snapshot = serializeAiConversationSnapshot(docKey, messages)
  try {
    await invoke('write_ai_conversation', {
      payload: { docKey, snapshot },
    })
  } catch {
    /* ignore persistence failures */
  }
}

async function deleteFromDisk(docKey: string): Promise<void> {
  try {
    await invoke('delete_ai_conversation', {
      payload: { docKey },
    })
  } catch {
    /* ignore persistence failures */
  }
}

function readFromWebStorage(docKey: string): AiChatMessage[] {
  try {
    const raw = localStorage.getItem(webStorageKey(docKey))
    if (!raw) return []
    return parseAiConversationSnapshot(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeToWebStorage(docKey: string, messages: AiChatMessage[]): void {
  try {
    const snapshot = serializeAiConversationSnapshot(docKey, messages)
    localStorage.setItem(webStorageKey(docKey), JSON.stringify(snapshot))
  } catch {
    /* ignore persistence failures */
  }
}

function deleteFromWebStorage(docKey: string): void {
  try {
    localStorage.removeItem(webStorageKey(docKey))
  } catch {
    /* ignore persistence failures */
  }
}

export async function loadPersistedAiConversation(docKey: string | null): Promise<AiChatMessage[]> {
  if (!docKey) return []
  if (isTauri()) return readFromDisk(docKey)
  return readFromWebStorage(docKey)
}

export async function persistAiConversation(
  docKey: string | null,
  messages: AiChatMessage[],
): Promise<void> {
  if (!docKey) return
  if (messages.length === 0) {
    if (isTauri()) await deleteFromDisk(docKey)
    else deleteFromWebStorage(docKey)
    return
  }
  if (isTauri()) await writeToDisk(docKey, messages)
  else writeToWebStorage(docKey, messages)
}

export function schedulePersistedAiConversation(
  docKey: string | null,
  messages: AiChatMessage[],
): void {
  if (!docKey) return
  const sanitized = sanitizeAiConversationMessages(messages)
  pendingSaveMessages.set(docKey, sanitized)
  const existing = pendingSaveTimers.get(docKey)
  if (existing) clearTimeout(existing)
  pendingSaveTimers.set(
    docKey,
    setTimeout(() => {
      pendingSaveTimers.delete(docKey)
      pendingSaveMessages.delete(docKey)
      void persistAiConversation(docKey, sanitized)
    }, SAVE_DEBOUNCE_MS),
  )
}

export async function flushPersistedAiConversation(docKey: string | null): Promise<void> {
  if (!docKey) return
  const timer = pendingSaveTimers.get(docKey)
  if (timer) {
    clearTimeout(timer)
    pendingSaveTimers.delete(docKey)
  }
  const pending = pendingSaveMessages.get(docKey)
  if (pending) {
    pendingSaveMessages.delete(docKey)
    await persistAiConversation(docKey, pending)
  }
}

export function resetAiConversationPersistenceForTests(): void {
  for (const timer of pendingSaveTimers.values()) clearTimeout(timer)
  pendingSaveTimers.clear()
  pendingSaveMessages.clear()
}
