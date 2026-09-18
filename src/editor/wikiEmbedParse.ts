/** Shared `![[target]]` parsing for markdown-it rules and lifts. */
export type ParsedWikiEmbedToken = {
  raw: string
  docKey: string
  heading?: string
  blockId?: string
  alias?: string
}

const WIKI_EMBED_RE =
  /^!\[\[([^\]|#^]+?)(?:#([^\]|^]+?))?(?:\^([^\]]+?))?(?:\|([^\]]+?))?\]\]/

const IMAGE_EMBED_EXT = /\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif)$/iu

export function parseWikiEmbedTokenAt(src: string, pos = 0): (ParsedWikiEmbedToken & { length: number }) | null {
  const slice = src.slice(pos)
  const m = WIKI_EMBED_RE.exec(slice)
  if (!m) return null
  return {
    raw: m[0],
    length: m[0].length,
    docKey: m[1]!.trim(),
    heading: m[2]?.trim() || undefined,
    blockId: m[3]?.trim() || undefined,
    alias: m[4]?.trim() || undefined,
  }
}

export function isImageEmbedTarget(target: string): boolean {
  return IMAGE_EMBED_EXT.test(target.trim())
}
