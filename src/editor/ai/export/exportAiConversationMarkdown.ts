import type { AiChatMessage } from '../aiChatTypes'

export type ExportAiConversationOptions = {
  title?: string | null
  exportedAt?: Date
}

function formatRoleHeading(role: AiChatMessage['role']): string {
  if (role === 'user') return 'User'
  if (role === 'assistant') return 'Assistant'
  return 'System'
}

export function serializeAiConversationMarkdown(
  messages: readonly AiChatMessage[],
  options?: ExportAiConversationOptions,
): string {
  const lines: string[] = ['# AI Conversation']
  const exportedAt = options?.exportedAt ?? new Date()
  lines.push(`> Exported: ${exportedAt.toISOString()}`)
  if (options?.title?.trim()) {
    lines.push(`> Note: ${options.title.trim()}`)
  }
  lines.push('')

  for (const message of messages) {
    if (!message.content.trim()) continue
    lines.push(`## ${formatRoleHeading(message.role)}`)
    lines.push('')
    lines.push(message.content.trim())
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

export async function copyAiConversationMarkdown(
  messages: readonly AiChatMessage[],
  options?: ExportAiConversationOptions,
): Promise<void> {
  const markdown = serializeAiConversationMarkdown(messages, options)
  await navigator.clipboard.writeText(markdown)
}

export function downloadAiConversationMarkdown(
  messages: readonly AiChatMessage[],
  options?: ExportAiConversationOptions & { filename?: string },
): void {
  const markdown = serializeAiConversationMarkdown(messages, options)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = (options?.exportedAt ?? new Date()).toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = options?.filename ?? `ai-conversation-${stamp}.md`
  anchor.click()
  URL.revokeObjectURL(url)
}
