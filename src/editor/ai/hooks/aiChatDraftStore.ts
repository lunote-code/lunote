/** Session-scoped composer drafts keyed by AI conversation doc key. */
const draftsByConversationKey = new Map<string, string>()

export function readAiChatDraft(conversationDocKey: string | null): string {
  if (!conversationDocKey) return ''
  return draftsByConversationKey.get(conversationDocKey) ?? ''
}

export function writeAiChatDraft(conversationDocKey: string | null, value: string): void {
  if (!conversationDocKey) return
  const trimmed = value
  if (trimmed) {
    draftsByConversationKey.set(conversationDocKey, trimmed)
    return
  }
  draftsByConversationKey.delete(conversationDocKey)
}

export function clearAllAiChatDrafts(): void {
  draftsByConversationKey.clear()
}

export function resetAiChatDraftStoreForTests(): void {
  draftsByConversationKey.clear()
}
