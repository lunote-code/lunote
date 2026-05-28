import type { Editor } from '@tiptap/core'

import {
  applyBlockPatch,
  createBlockPatch,
  runBlockTransaction,
  type BlockPatch,
  type BlockPatchChanges,
  type BlockPatchSource,
} from '../../codeBlockRuntime/kernel'
import { arbitrateCommit } from './commitArbiter'
import { convergeAfterCommit } from './stateConvergenceLayer'
import type { CommitChannel } from './runtimeTruthGraph'

export type UnifiedCommitOptions = {
  channel: CommitChannel
  label?: string
  recordHistory?: boolean
  editor?: Editor | null
}

export type UnifiedCommitResult = {
  applied: boolean
  changedBlockIds: string[]
  rejectedReason?: string
}

function applyPatches(
  patches: BlockPatch[],
  options: UnifiedCommitOptions,
): UnifiedCommitResult {
  const verdict = arbitrateCommit(options.channel, patches)
  if (!verdict.allowed) {
    return { applied: false, changedBlockIds: [], rejectedReason: verdict.reason }
  }

  const changedBlockIds: string[] = []

  runBlockTransaction(
    () => {
      for (const patch of patches) {
        const changed = applyBlockPatch(patch)
        if (changed) changedBlockIds.push(patch.blockId)
      }
    },
    {
      label: options.label ?? `unified:${options.channel}`,
      recordHistory: options.recordHistory ?? options.channel !== 'pm-derived',
    },
  )

  if (changedBlockIds.length > 0) {
    convergeAfterCommit({
      channel: options.channel,
      patches,
      changedBlockIds,
      editor: options.editor ?? null,
    })
  }

  return { applied: changedBlockIds.length > 0, changedBlockIds }
}

export function commitUnified(
  patches: BlockPatch[],
  options: UnifiedCommitOptions,
): UnifiedCommitResult {
  return applyPatches(patches, options)
}

export function commitUnifiedSingle(
  patch: BlockPatch,
  options: UnifiedCommitOptions,
): UnifiedCommitResult {
  return applyPatches([patch], options)
}

export function commitInputChange(args: {
  blockId: string
  changes: BlockPatchChanges
  commitId: string
  channel?: 'input' | 'ime' | 'paste'
  editor?: Editor | null
}): UnifiedCommitResult {
  const channel = args.channel ?? 'input'
  const patch = createBlockPatch(args.blockId, args.changes, 'cbr', args.commitId)
  return commitUnifiedSingle(patch, {
    channel,
    label: `input:${args.blockId}`,
    recordHistory: channel !== 'ime',
    editor: args.editor,
  })
}

export function commitPmDerived(
  patches: BlockPatch[],
  options?: { label?: string; editor?: Editor | null },
): UnifiedCommitResult {
  return commitUnified(patches, {
    channel: 'pm-derived',
    label: options?.label ?? 'pm-derived',
    recordHistory: false,
    editor: options?.editor,
  })
}

export function commitRemote(
  patch: BlockPatch,
  options?: { editor?: Editor | null },
): UnifiedCommitResult {
  return commitUnifiedSingle(
    { ...patch, source: 'remote' },
    {
      channel: 'collab',
      label: `remote:${patch.blockId}`,
      recordHistory: false,
      editor: options?.editor,
    },
  )
}

export function commitCbrUi(
  blockId: string,
  changes: BlockPatchChanges,
  commitId: string,
): UnifiedCommitResult {
  const patch = createBlockPatch(blockId, changes, 'cbr', commitId)
  return commitUnifiedSingle(patch, {
    channel: 'cbr-ui',
    label: `cbr-ui:${blockId}`,
    recordHistory: true,
  })
}

/** Map legacy BlockPatchSource → CommitChannel */
export function channelFromPatchSource(source: BlockPatchSource): CommitChannel {
  switch (source) {
    case 'pm':
      return 'pm-derived'
    case 'paste':
      return 'paste'
    case 'remote':
      return 'collab'
    case 'undo':
      return 'undo'
    case 'redo':
      return 'redo'
    default:
      return 'cbr-ui'
  }
}
