import type { BlockRenderOutput } from './blockRenderer'

const MAX_ENTRIES = 96

const cache = new Map<string, BlockRenderOutput>()

export function buildBlockRenderCacheKey(
  blockType: string,
  source: string,
  themeRevision: number,
): string {
  return `${blockType}\0${source}\0${themeRevision}`
}

export function getCachedBlockRender(key: string): BlockRenderOutput | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  // LRU touch
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

export function setCachedBlockRender(key: string, output: BlockRenderOutput): void {
  if (output.kind !== 'html') return
  if (cache.has(key)) cache.delete(key)
  cache.set(key, output)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest == null) break
    cache.delete(oldest)
  }
}

export function clearBlockRenderResultCache(): void {
  cache.clear()
}
