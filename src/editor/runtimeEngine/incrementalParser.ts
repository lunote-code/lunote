import { isMindmapSource } from '../mindmap/parseMindmap'

export type BlockParseKind = 'mermaid' | 'mindmap' | 'empty'

export type BlockParseResult = {
  blockId: string
  kind: BlockParseKind
  lineCount: number
  contentHash: string
  parsedAt: number
}

const parseCache = new Map<string, BlockParseResult>()

function hashSource(source: string): string {
  let h = 2166136261
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/** Increment: only parses the change block and does not scan the full text*/
export function parseChangedBlock(blockId: string, source: string): BlockParseResult {
  const contentHash = hashSource(source)
  const cached = parseCache.get(blockId)
  if (cached && cached.contentHash === contentHash) {
    return cached
  }

  const trimmed = source.trim()
  let kind: BlockParseKind = 'mermaid'
  if (!trimmed) kind = 'empty'
  else if (isMindmapSource(trimmed)) kind = 'mindmap'

  const result: BlockParseResult = {
    blockId,
    kind,
    lineCount: trimmed ? trimmed.split('\n').length : 0,
    contentHash,
    parsedAt: Date.now(),
  }
  parseCache.set(blockId, result)
  return result
}

export function invalidateBlockParse(blockId: string): void {
  parseCache.delete(blockId)
}

export function clearIncrementalParserCache(): void {
  parseCache.clear()
}
