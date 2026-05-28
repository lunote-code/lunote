/** Parse `<!-- body -->`; DOMPurify will strip off HTML comments and NodeView needs to be rendered separately*/
export function parseHtmlCommentBody(raw: string): string | null {
  const m = raw.trim().match(/^<!--([\s\S]*?)-->$/u)
  if (!m) return null
  return m[1]?.trim() ?? ''
}
