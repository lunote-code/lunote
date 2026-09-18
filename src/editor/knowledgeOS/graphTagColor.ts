import { getDocumentMeta } from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

const TAG_COLOR_PALETTE = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
  '#22c55e',
  '#0ea5e9',
  '#eab308',
  '#ef4444',
  '#64748b',
] as const

function hashTagKey(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function graphTagColor(tag: string): string {
  const index = hashTagKey(tag.toLowerCase()) % TAG_COLOR_PALETTE.length
  return TAG_COLOR_PALETTE[index] ?? TAG_COLOR_PALETTE[0]
}

export function graphPrimaryTagColor(docKey: DocKey): string | undefined {
  const tag = getDocumentMeta(docKey)?.outboundTags[0]
  return tag ? graphTagColor(tag) : undefined
}
