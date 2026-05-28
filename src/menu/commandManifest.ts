/**
 * Command Manifest System — The single source of truth for menus/command panels/toolbars/shortcut keys.
 */
export * from './commandManifest.types'
export * from './commandManifest.entries'
export * from './commandManifest.structure'
export {
  buildAppMenuSchema,
  eachManifestPaletteCommand,
  findMenuPathForCommand,
  getManifestEntry,
  getManifestEntryOrThrow,
  listManifestWithAccelerator,
  manifestToMenuLeaf,
} from './commandManifest.build'
export { compilePaletteFromManifest, compileToolbarFromManifest, listManifestByGroup } from './manifestCompile'
export type { EditorContext, EditorPaneMode, EditorNodeType } from './commandContext'
export {
  buildEditorContextFromPmState,
  buildNullEditorContext,
  buildSourceEditorContext,
  buildVisualEditorContext,
  isCodeGuardedContext,
} from './commandContext'
export type { ResolvedCommand, CommandResolver } from './commandResolution.types'
export { VM_MUTATION_KINDS } from './commandResolution.types'
export { resolveCommand } from './commandResolve'
export {
  executeManifestCommand,
  executeResolvedCommand,
  tryExecuteResolvedManifestAction,
} from './commandExecute'
export { COMMAND_RESOLUTION_REGISTRY, hasCommandResolver } from './commandResolution.rules'
export type { CommandTransaction, EditorOp } from './commandTransaction'
export type { SourceEditorOp } from './commandOps.types'
export {
  createTransaction,
  executeOps,
  redoLastTransaction,
  resetTransactionLog,
  setActiveTransactionDoc,
  undoLastTransaction,
} from './commandTransaction'
// Step log utilities (for advanced consumers)
export { getUndoDepth, getRedoDepth, resetStepLog } from '../vm/vmStepLog'
