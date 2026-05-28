import { resolveDocKey } from './knowledgeRegistry'
import type { BlockRefId, DocKey, ParsedBlockRef } from './types'

export type BlockAnchor = {
  docKey: DocKey
  blockId: BlockRefId
}

type BlockAnchorRecord = {
  docKey: DocKey
  line: number | null
}

const blockOwners = new Map<string, BlockAnchorRecord>()

function anchorKey(docKey: DocKey, blockId: BlockRefId): string {
  return `${docKey}#^${blockId}`
}

export function registerBlockRefs(docKey: DocKey, refs: ParsedBlockRef[]): void {
  unregisterBlockRefs(docKey)
  for (const r of refs) {
    blockOwners.set(anchorKey(docKey, r.blockId), {
      docKey,
      line: typeof r.line === 'number' && Number.isFinite(r.line) ? Math.max(1, Math.trunc(r.line)) : null,
    })
  }
}

export function unregisterBlockRefs(docKey: DocKey): void {
  for (const [key, owner] of blockOwners) {
    if (owner.docKey === docKey) blockOwners.delete(key)
  }
}

export function resolveBlockAnchor(
  docKeyOrTitle: string,
  blockId: BlockRefId,
): BlockAnchor | null {
  const docKey = resolveDocKey(docKeyOrTitle)
  if (!docKey) return null
  const key = anchorKey(docKey, blockId)
  const owner = blockOwners.get(key)
  if (owner && owner.docKey !== docKey) return null
  return { docKey, blockId }
}

export function resolveBlockInDocument(docKey: DocKey, blockId: BlockRefId): boolean {
  return blockOwners.get(anchorKey(docKey, blockId))?.docKey === docKey
}

export function resolveBlockLineInDocument(docKey: DocKey, blockId: BlockRefId): number | null {
  const rec = blockOwners.get(anchorKey(docKey, blockId))
  if (!rec || rec.docKey !== docKey) return null
  return rec.line
}

export function resetBlockReferenceIndex(): void {
  blockOwners.clear()
}
