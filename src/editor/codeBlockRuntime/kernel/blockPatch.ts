import type { CodeBlockMode } from '../types'

export type BlockPatchSource = 'pm' | 'cbr' | 'undo' | 'redo' | 'paste' | 'remote'

export type BlockPatchChanges = {
  draft?: string
  mode?: CodeBlockMode
  scrollTop?: number
  height?: number
}

export type BlockPatch = {
  blockId: string
  changes: BlockPatchChanges
  commitId: string
  source: BlockPatchSource
  timestamp: number
}

/** patch input without blockId / timestamp (for use by applyBlockPatch(blockId, patch))*/
export type BlockPatchInput = {
  changes: BlockPatchChanges
  commitId: string
  source: BlockPatchSource
  timestamp?: number
}

export function createBlockPatch(
  blockId: string,
  changes: BlockPatchChanges,
  source: BlockPatchSource,
  commitId: string,
): BlockPatch {
  return {
    blockId,
    changes,
    commitId,
    source,
    timestamp: Date.now(),
  }
}

export function toBlockPatch(blockId: string, input: BlockPatchInput): BlockPatch {
  return {
    blockId,
    changes: input.changes,
    commitId: input.commitId,
    source: input.source,
    timestamp: input.timestamp ?? Date.now(),
  }
}
