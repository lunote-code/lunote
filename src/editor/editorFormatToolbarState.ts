import type { Editor } from '@tiptap/core'

const FORMAT_COMMAND_ACTIVE_MARK: Record<string, string> = {
  'fmt-bold': 'bold',
  'fmt-italic': 'italic',
  'fmt-underline': 'underline',
  'fmt-inline-code': 'code',
  'fmt-strike': 'strike',
  'fmt-highlight': 'highlight',
  'fmt-link': 'link',
}

export function resolveFormatToolbarCommandActive(
  editor: Editor | null | undefined,
  commandId: string,
): boolean {
  if (!editor || editor.isDestroyed) return false

  const markName = FORMAT_COMMAND_ACTIVE_MARK[commandId]
  if (!markName) return false

  return editor.isActive(markName)
}
