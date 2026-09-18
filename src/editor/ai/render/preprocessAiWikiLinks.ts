/** Convert `[[wiki links]]` to internal markdown links before AI assistant preview render. */
const AI_WIKI_LINK_RE =
  /(!)?\[\[([^\]|#^]+?)(?:#([^\]|^]+?))?(?:\^([^\]]+?))?(?:\|([^\]]+?))?\]\]/g

export const AI_WIKI_LINK_HREF_PREFIX = '#ai-wiki:'

export function encodeAiWikiLinkTarget(target: {
  docKey: string
  heading?: string
  blockId?: string
}): string {
  return `${AI_WIKI_LINK_HREF_PREFIX}${encodeURIComponent(JSON.stringify(target))}`
}

export function decodeAiWikiLinkPayload(encoded: string): {
  docKey: string
  heading?: string
  blockId?: string
} | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as {
      docKey?: string
      heading?: string
      blockId?: string
    }
    if (!parsed.docKey?.trim()) return null
    return {
      docKey: parsed.docKey.trim(),
      ...(parsed.heading?.trim() ? { heading: parsed.heading.trim() } : {}),
      ...(parsed.blockId?.trim() ? { blockId: parsed.blockId.trim() } : {}),
    }
  } catch {
    return null
  }
}

export function decodeAiWikiLinkTarget(href: string): {
  docKey: string
  heading?: string
  blockId?: string
} | null {
  if (!href.startsWith(AI_WIKI_LINK_HREF_PREFIX)) return null
  return decodeAiWikiLinkPayload(href.slice(AI_WIKI_LINK_HREF_PREFIX.length))
}

export function preprocessAiWikiLinks(markdown: string): string {
  return markdown.replace(
    AI_WIKI_LINK_RE,
    (raw, embed: string | undefined, target: string, heading?: string, blockId?: string, alias?: string) => {
      if (embed) return raw
      const docKey = target.trim()
      if (!docKey) return raw
      const display = (alias?.trim() || docKey).replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
      const href = encodeAiWikiLinkTarget({
        docKey,
        ...(heading?.trim() ? { heading: heading.trim() } : {}),
        ...(blockId?.trim() ? { blockId: blockId.trim() } : {}),
      })
      return `[${display}](${href})`
    },
  )
}
