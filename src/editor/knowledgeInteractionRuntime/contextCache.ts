type CacheEntry<T> = {
  value: T
  contentHash: string
  touchedAt: number
}

export type LruCacheOptions = {
  maxEntries: number
}

export class ContextLruCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>()
  private readonly maxEntries: number

  constructor(options: LruCacheOptions) {
    this.maxEntries = options.maxEntries
  }

  get(key: string, contentHash?: string): T | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (contentHash != null && entry.contentHash !== contentHash) {
      this.map.delete(key)
      return undefined
    }
    entry.touchedAt = performance.now()
    return entry.value
  }

  set(key: string, value: T, contentHash: string): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, contentHash, touchedAt: performance.now() })
    this.evictIfNeeded()
  }

  invalidateByHash(contentHash: string): void {
    for (const [key, entry] of this.map) {
      if (entry.contentHash === contentHash) this.map.delete(key)
    }
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key)
    }
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }

  private evictIfNeeded(): void {
    while (this.map.size > this.maxEntries) {
      let oldestKey: string | null = null
      let oldest = Infinity
      for (const [key, entry] of this.map) {
        if (entry.touchedAt < oldest) {
          oldest = entry.touchedAt
          oldestKey = key
        }
      }
      if (oldestKey) this.map.delete(oldestKey)
      else break
    }
  }
}

/** Global KIR cache partition*/
export const previewCache = new ContextLruCache<unknown>({ maxEntries: 128 })
export const snippetCache = new ContextLruCache<unknown>({ maxEntries: 256 })
export const rankCache = new ContextLruCache<unknown>({ maxEntries: 512 })
export const graphNeighborhoodCache = new ContextLruCache<unknown>({ maxEntries: 64 })
export const mentionCandidateCache = new ContextLruCache<unknown>({ maxEntries: 200 })

export function resetContextCaches(): void {
  previewCache.clear()
  snippetCache.clear()
  rankCache.clear()
  graphNeighborhoodCache.clear()
  mentionCandidateCache.clear()
}
