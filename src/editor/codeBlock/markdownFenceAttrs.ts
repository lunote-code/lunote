/** Reserved fence info tokens for Luna code block UI state (not language ids). */
export const CODE_FENCE_FOLDED_FLAG = 'folded'
export const CODE_FENCE_DIFF_MODE_FLAG = 'diff-mode'

export type CodeFenceMarkdownAttrs = {
  language: string | null
  folded: boolean
  diffMode: boolean
}

/** Parse markdown-it fence `info` into codeBlock attrs. Language is the first non-reserved token. */
export function parseCodeFenceInfo(info: string | null | undefined): CodeFenceMarkdownAttrs {
  const tokens = (info ?? '').trim().split(/\s+/u).filter(Boolean)
  let language: string | null = null
  let folded = false
  let diffMode = false

  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === CODE_FENCE_FOLDED_FLAG) {
      folded = true
      continue
    }
    if (lower === CODE_FENCE_DIFF_MODE_FLAG) {
      diffMode = true
      continue
    }
    if (language === null) {
      language = token
    }
  }

  return { language, folded, diffMode }
}

/** Serialize codeBlock attrs into a fence info suffix (may be empty). */
export function formatCodeFenceInfo(attrs: {
  language?: string | null
  folded?: boolean | null
  diffMode?: boolean | null
}): string {
  const parts: string[] = []
  const lang = String(attrs.language ?? '').trim()
  if (lang) parts.push(lang)
  if (attrs.folded) parts.push(CODE_FENCE_FOLDED_FLAG)
  if (attrs.diffMode) parts.push(CODE_FENCE_DIFF_MODE_FLAG)
  return parts.join(' ')
}
