import type { BlockPatchChanges } from '../kernel/blockPatch'

export type RemoteBlockPatch = {
  patchId: string
  blockId: string
  changes: Partial<BlockPatchChanges>
  actorId: string
  timestamp: number
  baseVersion: number
  commitId: string
}

export type LocalBlockPatch = {
  patchId: string
  blockId: string
  changes: Partial<BlockPatchChanges>
  timestamp: number
  commitId: string
}

export function createRemoteBlockPatch(
  input: Omit<RemoteBlockPatch, 'timestamp'> & { timestamp?: number },
): RemoteBlockPatch {
  return {
    ...input,
    timestamp: input.timestamp ?? Date.now(),
  }
}

export function remotePatchSortKey(patch: RemoteBlockPatch): string {
  const ts = String(patch.timestamp).padStart(15, '0')
  return `${ts}:${patch.patchId}`
}
