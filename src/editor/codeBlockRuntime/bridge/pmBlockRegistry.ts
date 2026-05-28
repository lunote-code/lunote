/**
 * Bridge layer PM metadata (pos/commitId), separated from CBR blockMap.
 * Written during Mermaid session registration; shared by PM→CBR / CBR→PM.
 */

export type PmBlockMeta = {
  pos: number
  commitId: string
  version: number
}

const pmMetaByBlockId = new Map<string, PmBlockMeta>()

export function getPmMetaForBlock(blockId: string): PmBlockMeta | undefined {
  return pmMetaByBlockId.get(blockId)
}

export function listPmMetaBlockIds(): string[] {
  return [...pmMetaByBlockId.keys()]
}

export function setPmMeta(blockId: string, meta: PmBlockMeta): void {
  pmMetaByBlockId.set(blockId, meta)
}

export function updatePmMetaPos(blockId: string, pos: number): void {
  const meta = pmMetaByBlockId.get(blockId)
  if (!meta || meta.pos === pos) return
  meta.pos = pos
}

export function setPmCommitId(blockId: string, commitId: string): void {
  const meta = pmMetaByBlockId.get(blockId)
  if (!meta) return
  meta.commitId = commitId
}

export function getPmBlockVersion(blockId: string): number {
  return pmMetaByBlockId.get(blockId)?.version ?? 0
}

export function bumpPmBlockVersion(blockId: string, next?: number): number {
  const meta = pmMetaByBlockId.get(blockId)
  if (!meta) return 0
  meta.version = next ?? meta.version + 1
  return meta.version
}

export function removePmMeta(blockId: string): boolean {
  return pmMetaByBlockId.delete(blockId)
}

export function clearPmMeta(): void {
  pmMetaByBlockId.clear()
}
