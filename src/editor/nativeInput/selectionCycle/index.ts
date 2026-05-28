export type { SelectionSnapshot } from './selectionSnapshot'
export {
  captureSelection,
  createSelectionSnapshot,
  hashTextareaValue,
  restoreSelection,
  snapshotMatchesValue,
  textFromSnapshot,
} from './selectionSnapshot'
export {
  isAnySelectionLocked,
  isSelectionLocked,
  lockSelection,
  unlockSelection,
} from './selectionLock'
export { cancelScheduledRestore, scheduleSelectionRestore } from './selectionRestoreQueue'
export {
  applyTextareaValueMutation,
  detachSelectionCycle,
  runSelectionCycle,
  runWithoutSelectionMutation,
} from './selectionCycleController'
export {
  attachSelectionCycleComposition,
  clearTextareaComposition,
  isTextareaComposing,
  setTextareaComposing,
} from './selectionComposition'
export * from './v2'
