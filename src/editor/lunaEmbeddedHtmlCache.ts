const MAX_CACHE_ENTRIES = 256

const renderedHtmlCache = new Map<string, string>()

const EMBEDDED_MEDIA_TAG_RE = /<(?:img|video|source)\b/i

export function buildEmbeddedHtmlCacheKey(scope: string, html: string): string {
  if (!scope) return ''
  return `${scope}\u0000${html}`
}

export function readEmbeddedHtmlCache(key: string): string | undefined {
  if (!key) return undefined
  return renderedHtmlCache.get(key)
}

export function writeEmbeddedHtmlCache(key: string, value: string): void {
  if (!key) return
  if (renderedHtmlCache.size >= MAX_CACHE_ENTRIES) {
    const first = renderedHtmlCache.keys().next().value
    if (first) renderedHtmlCache.delete(first)
  }
  renderedHtmlCache.set(key, value)
}

export function clearEmbeddedHtmlCache(): void {
  renderedHtmlCache.clear()
}

export function embeddedHtmlHasResolvableMedia(html: string): boolean {
  return EMBEDDED_MEDIA_TAG_RE.test(html)
}

/** Test-only: number of cached rendered HTML fragments. */
export function embeddedHtmlCacheSizeForTests(): number {
  return renderedHtmlCache.size
}
