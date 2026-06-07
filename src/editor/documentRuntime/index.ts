export type { DocumentTickKind } from './documentClock'
export { bumpDocumentTick, getDocumentEpoch, getDocumentTick, resetDocumentClock } from './documentClock'
export type { AuthorityDomain, AuthoritySource } from './runtimeAuthority'
export { getAuthority, isAuthority, setAuthority } from './runtimeAuthority'
export type { GraphPhase, GraphNodeKind } from './lifecycleGraph'
export {
  clearLifecycleGraph,
  ensureDocumentNode,
  getBlockGraphPhase,
  getDocumentPhase,
  listBlockNodes,
  mapViewportToGraphPhase,
  removeBlockNode,
  setDocumentPhase,
  transitionBlockPhase,
} from './lifecycleGraph'
export type { SelectionRealm, AuthoritativeSelection } from './selectionRuntime'
export {
  clearAuthoritativeSelection,
  commitBlockSelection,
  commitBlockTextSelection,
  commitPmSelection,
  getAuthoritativeSelection,
  subscribeSelectionRuntime,
} from './selectionRuntime'
export type { FocusRealm } from './focusRuntime'
export {
  acquireBlockTextareaFocus,
  clearDocumentFocus,
  getFocusBlockId,
  getFocusRealm,
  releaseBlockTextareaFocus,
  setBlockFocus,
  setNativeTextareaComposing,
  syncFocusFromCbr,
} from './focusRuntime'
export type { BlockLayoutMeasure } from './layoutRuntime'
export {
  clearBlockLayoutMeasure,
  commitBlockLayoutMeasure,
  getBlockLayoutMeasure,
  measureBlockSurface,
} from './layoutRuntime'
export type { ScrollAnchor, ViewportWindow } from './viewportRuntime'
export {
  clearViewportRuntime,
  getViewportRuntimeRevision,
  getScrollAnchor,
  getScrollRoot,
  getViewportWindow,
  markBlockNearOnly,
  notifyBlockIntersection,
  observeBlockViewport,
  registerScrollRoot,
  setScrollAnchor,
  subscribeViewportRuntime,
  shouldBlockRenderInViewport,
} from './viewportRuntime'
export {
  isElementLikelyInViewport,
  isElementNearViewport,
  primeBlockViewportOnMount,
  seedBlockViewportIfVisible,
} from './seedBlockViewport'
export type { RuntimeTask, RuntimeTaskKind } from './runtimeScheduler'
export {
  cancelRuntimeTask,
  drainRuntimeTasks,
  flushRuntimeTasks,
  getRuntimeSchedulerPhase,
  getRuntimeTaskQueueDepth,
  scheduleRuntimeTask,
} from './runtimeScheduler'
export type {
  RuntimePhase,
  OrderedRuntimeTask,
  RuntimeTransaction,
  RuntimeTransactionOp,
  AtomicCommitSlice,
  BlockCommitScope,
  GuardedCommitOptions,
} from './deterministic'
export {
  RUNTIME_PHASE_ORDER,
  RUNTIME_DEPENDENCY_EDGES,
  compareRuntimePhase,
  isPhaseBefore,
  phaseFromTaskKind,
  getPhaseSuccessors,
  getRuntimeGraphPhases,
  requiresUpstreamPhase,
  compareOrderedTasks,
  nextRuntimeSequence,
  resetRuntimeOrdering,
  sortOrderedTasks,
  canPassCommitBarrier,
  clearCommitBarriers,
  getBarrierPhase,
  markBarrierComplete,
  arbitrateAuthority,
  arbitrateCrossRuntime,
  beginRuntimeTransaction,
  stageTransactionOp,
  abortRuntimeTransaction,
  commitTransactionOps,
  flushAtomicCommit,
  stageAtomicCommit,
  resetAtomicCommit,
  clearRuntimeTransactions,
  openBlockCommitScope,
  revokeBlockCommitScope,
  bumpBlockCommitGeneration,
  getBlockCommitGeneration,
  isBlockCommitAllowed,
  runGuardedAsyncCommit,
  clearAsyncCommitGuards,
} from './deterministic'
export { bindPmSelectionToDocumentRuntime, createPmSelectionBridgePlugin } from './pmSelectionBridge'
export { LunaDocumentRuntime } from './LunaDocumentRuntime'
export type {
  NativeInputFocusState,
  NativeInputRegistration,
  NativeInputType,
  RuntimeBypassReason,
} from './nativeInput'
export {
  NATIVE_INPUT_AUTHORITY,
  NATIVE_INPUT_HOST_SELECTOR,
  NATIVE_INPUT_SELECTOR,
  activateNativeInput,
  bypassRuntimePointer,
  claimNativeInputAuthority,
  clearNativeInputRegistry,
  deactivateNativeInput,
  findNativeInputForTarget,
  getActiveNativeInputId,
  getNativeInputBoundaryRoot,
  isInsideNativeInputBoundary,
  isNativeInputActive,
  isNativeInputAuthorityHeld,
  isNativeInputComposing,
  isNativeInputDom,
  isNativeInputTarget,
  isNativeTextInputDom,
  isNativeTextInputElement,
  mountNativeInput,
  registerNativeInput,
  releaseNativeInputAuthority,
  resetNativeInputRuntime,
  setNativeInputComposing,
  shouldBlockRuntimeFocusSteal,
  shouldBlockRuntimeSelectionCommit,
  shouldBypassPmSelectionSync,
  shouldBypassRuntimeForBlock,
  shouldBypassRuntimeForTarget,
  shouldBypassRuntimeSchedulerTask,
  shouldRuntimeYieldToNativeInput,
  unmountNativeInput,
  unregisterNativeInput,
} from './nativeInput'
export type {
  CommitChannel,
  CommitArbitration,
  ConvergenceContext,
  DivergenceKind,
  DivergenceReport,
  TruthLayer,
  UnifiedCommitOptions,
  UnifiedCommitResult,
} from './sourceOfTruth'
export {
  TRUTH_LAYER_ORDER,
  arbitrateCommit,
  channelFromPatchSource,
  channelTargetsCanonical,
  commitCbrUi,
  commitInputChange,
  commitInputDraft,
  commitPmDerived,
  commitRemote,
  commitUnified,
  detectBlockDraftDivergence,
  detectSnapshotDivergence,
  getCanonicalEpoch,
  getCanonicalSnapshot,
  getLastDivergenceReports,
  isDerivedLayer,
  publishCanonicalSnapshot,
  scanDivergence,
  subscribeCanonicalSnapshot,
} from './sourceOfTruth'
