/** Shared source-markdown line/cursor helpers (Tab keymap, command context). */

export const SOURCE_MARKDOWN_TAB_SPACES = '    '

export function sourceCursorInCodeFence(doc: string, pos: number): boolean {
  let fenceOpenAt: number | null = null
  let offset = 0
  for (const line of doc.split('\n')) {
    const lineStart = offset
    const lineEnd = offset + line.length
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```')) {
      if (fenceOpenAt == null) {
        fenceOpenAt = lineStart
      } else {
        if (pos >= fenceOpenAt && pos <= lineEnd) return true
        fenceOpenAt = null
      }
    }
    if (fenceOpenAt != null && pos >= fenceOpenAt && pos <= lineEnd) return true
    offset = lineEnd + 1
  }
  return fenceOpenAt != null && pos >= fenceOpenAt
}

export function isMarkdownFenceDelimiterLine(text: string): boolean {
  return text.trimStart().startsWith('```')
}

export function isMarkdownTableRowLine(text: string): boolean {
  const t = text.trim()
  if (!t.includes('|')) return false
  return /^\|?.+\|/u.test(t) || /^\|[-:| ]+\|/u.test(t)
}

/** List marker line (task, bullet, ordered), optional leading blockquote `>`. */
export function isMarkdownListLine(text: string): boolean {
  const body = text.replace(/^(?:\s*>\s*)+/u, '')
  return /^\s*([-*+]|\d+\.)\s/u.test(body) || /^\s*-\s+\[[ xX]\]\s/u.test(body)
}
