import type { CodeBlockMode } from '../types'
import { getBlock, getCodeBlockRuntimeSnapshot, getFocusedBlockId } from '../codeBlockRuntimeStore'
import { getPmMetaForBlock, listPmMetaBlockIds } from '../bridge/pmBlockRegistry'

export type RuntimeSnapshotBlock = {
  draft: string
  mode: CodeBlockMode
  commitId: string
  dirty: boolean
  height: number
  scrollTop: number
}

export type RuntimeSnapshot = {
  version: number
  focusedBlockId: string | null
  blocks: Record<string, RuntimeSnapshotBlock>
}

let snapshotVersion = 0

export function createRuntimeSnapshot(): RuntimeSnapshot {
  snapshotVersion += 1
  const blocks: Record<string, RuntimeSnapshotBlock> = {}

  for (const blockId of listPmMetaBlockIds()) {
    const runtime = getBlock(blockId)
    const meta = getPmMetaForBlock(blockId)
    if (!runtime || !meta) continue
    blocks[blockId] = {
      draft: runtime.state.draft,
      mode: runtime.state.mode,
      commitId: meta.commitId,
      dirty: runtime.ui.dirty,
      height: runtime.state.height,
      scrollTop: runtime.state.scrollTop,
    }
  }

  return {
    version: snapshotVersion,
    focusedBlockId: getFocusedBlockId(),
    blocks,
  }
}

export function getRuntimeSnapshotVersion(): number {
  return snapshotVersion
}

/** Shallow comparison: whether to use snapshot*/
export function snapshotDiffers(a: RuntimeSnapshot, b: RuntimeSnapshot): boolean {
  const aIds = Object.keys(a.blocks).sort()
  const bIds = Object.keys(b.blocks).sort()
  if (aIds.length !== bIds.length) return true
  for (let i = 0; i < aIds.length; i++) {
    if (aIds[i] !== bIds[i]) return true
    const x = a.blocks[aIds[i]!]!
    const y = b.blocks[bIds[i]!]!
    if (
      x.draft !== y.draft ||
      x.mode !== y.mode ||
      x.commitId !== y.commitId ||
      x.dirty !== y.dirty ||
      x.height !== y.height ||
      x.scrollTop !== y.scrollTop
    ) {
      return true
    }
  }
  return a.focusedBlockId !== b.focusedBlockId
}

export function getPendingBlockIds(): string[] {
  return [...getCodeBlockRuntimeSnapshot().pendingByBlockId.keys()]
}
