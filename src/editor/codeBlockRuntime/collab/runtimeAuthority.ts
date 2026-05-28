import { getBlock, getFocusedBlockId } from '../codeBlockRuntimeStore'
import { getPmBlockVersion } from '../bridge/pmBlockRegistry'
import { isMermaidSourceComposing } from '../../mermaid/mermaidSourceStore'

const suspendedBlocks = new Set<string>()

export function isRemotePatchSuspended(blockId: string): boolean {
  return suspendedBlocks.has(blockId)
}

export function suspendRemotePatch(blockId: string): void {
  if (!blockId) return
  suspendedBlocks.add(blockId)
}

export function resumeRemotePatch(blockId: string): void {
  if (!blockId) return
  suspendedBlocks.delete(blockId)
}

export function clearSuspendedBlocks(blockId?: string): void {
  if (blockId) suspendedBlocks.delete(blockId)
  else suspendedBlocks.clear()
}

export type AuthorityDomain = 'draft' | 'mode' | 'layout'

export type DraftAuthority = 'local' | 'pm' | 'remote'

/** draft: focus on local when editing; otherwise PM is the true source of the document*/
export function getDraftAuthority(blockId: string): DraftAuthority {
  if (isBlockLocallyAuthoritative(blockId)) return 'local'
  return 'pm'
}

export function isBlockLocallyAuthoritative(blockId: string): boolean {
  if (isRemotePatchSuspended(blockId)) return true
  if (getFocusedBlockId() === blockId) return true
  if (isMermaidSourceComposing() && getFocusedBlockId() === blockId) return true
  return false
}

/** Whether the remote draft should be enqueued (without immediately overwriting the textarea)*/
export function shouldQueueRemoteDraft(blockId: string): boolean {
  return isBlockLocallyAuthoritative(blockId)
}

/** mode/layout: can be merged immediately when not focused; when focused, draft is queued but layout can still be applied*/
export function canApplyRemoteField(
  blockId: string,
  field: keyof import('../kernel/blockPatch').BlockPatchChanges,
): boolean {
  if (field === 'draft') return !shouldQueueRemoteDraft(blockId)
  return true
}

export function isRemotePatchStale(blockId: string, baseVersion: number): boolean {
  return baseVersion < getPmBlockVersion(blockId)
}

export function getLocalRuntimeVersion(blockId: string): number {
  const block = getBlock(blockId)
  if (!block) return 0
  return getPmBlockVersion(blockId)
}
