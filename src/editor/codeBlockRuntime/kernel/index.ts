export type { BlockPatch, BlockPatchChanges, BlockPatchInput, BlockPatchSource } from './blockPatch'
export { createBlockPatch, toBlockPatch } from './blockPatch'
export type { BlockTransactionContext } from './blockTransaction'
export { getActiveBlockTransaction, getTransactionPatchCount, isInsideBlockTransaction } from './blockTransaction'
export {
  applyBlockPatch,
  inferPmPatchSource,
  newPatchCommitId,
  pushSnapshot,
  restoreRuntimeSnapshot,
  restoreSnapshot,
  runBlockTransaction,
  type RunBlockTransactionOptions,
} from './transactionKernel'
export {
  clearRuntimeHistory,
  getRuntimeHistoryIndex,
  getRuntimeHistorySize,
  peekRuntimeSnapshot,
  pushRuntimeSnapshot,
  redoRuntimeSnapshot,
  undoRuntimeSnapshot,
} from './runtimeHistory'
export type { RuntimeSnapshot, RuntimeSnapshotBlock } from './runtimeSnapshot'
export { createRuntimeSnapshot, getRuntimeSnapshotVersion, snapshotDiffers } from './runtimeSnapshot'
