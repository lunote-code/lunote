/**
 * Knowledge OS — Local-first Obsidian-like knowledge workspace (no collaboration).
 *
 * Filesystem → Vault → Knowledge Runtime → KIR → KSR → Knowledge OS → React UI
 */

export type * from './types'

export {
  registerVaultFileAdapter,
  getVaultFileAdapter,
  openKnowledgeVault,
  closeKnowledgeVault,
  getKnowledgeVaultSession,
  getKnowledgeVaultRoot,
  docKeyToAbsolutePath,
  absolutePathToDocKeyOs,
  loadNoteContent,
  saveNoteContent,
  noteTitleFromDocKey,
} from './vaultRuntime'

export {
  createNote,
  deleteNote,
  renameNote,
  propagateWikiLinksInVault,
  resetNoteLifecycleRuntime,
} from './noteLifecycleRuntime'

export { resolveWikiTarget, resolveWikiLinkFromRaw, isWikiLinkResolvable } from './wikiLinkRuntime'

export {
  setBacklinkPanelDocKey,
  refreshBacklinkPanel,
  getBacklinkPanelSnapshot,
  subscribeBacklinkPanel,
  resetBacklinkPanelRuntime,
} from './backlinkPanelRuntime'

export {
  setNoteGraphCenter,
  syncNoteGraphTopologyFromRoute,
  resolveRouteCenterNode,
  flushDeferredGraphLayout,
  getNoteGraphTopology,
  getNoteGraphSnapshot,
  getVisibleGraphNodes,
  setNoteGraphViewport,
  subscribeNoteGraph,
  resetNoteGraphRuntime,
} from './noteGraphRuntime'

export {
  getIsKnowledgeNavigating,
  getIsGraphUpdating,
  getNavigationSessionVersion,
  bumpNavigationIntentVersion,
  subscribeNavigationEndOnce,
  subscribeNavigationEnd,
} from './graphInteractionGuard'

export {
  runKnowledgeSearch,
  getKnowledgeSearchSnapshot,
  subscribeKnowledgeSearch,
  clearKnowledgeSearchCache,
  resetKnowledgeSearchRuntime,
} from './knowledgeSearchRuntime'

export {
  navigateToDocKey,
  navigateToWikiLink,
  navigateToAbsolutePath,
  navigationBack,
  navigationForward,
  getNavigationSnapshot,
  consumeLastNavigationSource,
  peekLastNavigationSource,
  subscribeNavigation,
  resetNoteNavigationRuntime,
} from './noteNavigationRuntime'
export {
  normalizeHeadingToSlug,
  resolveEditorAnchor,
  resolveHeadingSlug,
  waitForEditorDocumentReady,
  waitForEditorLayoutStable,
} from './editorAnchorNavigation'
export type { EditorAnchorRevealRequest, ResolvedEditorAnchor } from './editorAnchorNavigation'
export {
  beginNavigationReveal,
  getNavigationRevealGeneration,
  isNavigationRevealCurrent,
  isEditorNavigationAnchorReady,
  waitUntilEditorNavigationReady,
} from './editorNavigationReadiness'
export type {
  EditorNavigationReadinessProbe,
  EditorNavigationReadyRequest,
  EditorNavigationReadyResult,
  MainPaneMode,
  VisualNavigationHydrationStatus,
} from './editorNavigationReadiness'
export {
  beginGraphNodeViewportFocus,
  shouldSuppressAutoGraphViewportCenter,
} from './graphViewportFocusRuntime'

export {
  openKnowledgeWorkspace,
  openNoteInWorkspace,
  activateWorkspaceTab,
  closeWorkspaceTab,
  getKnowledgeWorkspaceSnapshot,
  subscribeKnowledgeWorkspace,
  persistWorkspaceSession,
  persistKnowledgeUILayout,
  restoreWorkspaceSessionFromStorage,
  restoreKnowledgeUILayoutFromStorage,
  resetKnowledgeWorkspaceRuntime,
} from './knowledgeWorkspaceRuntime'

export {
  initKnowledgeOS,
  onKnowledgeOSWorkspaceOpened,
  onKnowledgeOSWorkspaceClosing,
  getKnowledgeOSSnapshot,
  getKnowledgeOSRevision,
  subscribeKnowledgeOSSnapshot,
  requestOsRevision,
  bumpOsRevisionImmediate,
  invalidateKnowledgeOSSnapshot,
  resetKnowledgeOS,
} from './knowledgeUIBridge'

export {
  getCurrentOSKernelTick,
  getLiveOSKernelTick,
  mapFrameToRevision,
  mapRevisionToFrame,
  mapRevisionToFrameIndex,
  enterTimeTravelAtFrame,
  resetOSKernelClock,
  subscribeOSKernelClock,
} from './osKernelClock'
export type { OSKernelTickId, OSKernelTickRecord, OSKernelTickSource } from './osKernelClock'

export { buildKernelTickState, projectUnifiedKnowledgeOSSlice } from './osKernelProjection'
export type { OSKernelTickState } from './osKernelProjection'

export {
  runKnowledgeInteraction,
  transactionToIntent,
  dispatchKnowledgeNavigate,
  dispatchKnowledgeNavigateHit,
  dispatchWikiHover,
  dispatchOpenKnowledgeSearch,
  buildInteractionPlan,
  composeInteractions,
  executeInteractionPlan,
  executeKnowledgeIntent,
  executeKnowledgeIntents,
} from './ui/interactionTransaction'
export type { InteractionIntent, InteractionPlan, InteractionStep } from './ui/interactionTransaction'

export {
  registerKnowledgeInteractionHost,
  getKnowledgeInteractionHost,
} from './ui/knowledgeInteractionHost'

export { useKnowledgeOSSnapshot } from './ui/useKnowledgeOSSnapshot'
export {
  useBacklinkSlice,
  useGraphSlice,
  useSearchSlice,
  useInteractionKernelSlice,
  useSurfaceLayoutSlice,
  useGraphViewportSlice,
} from './ui/useKnowledgeOSSlice'

export { useSurfaceLayout } from './ui/useSurfaceLayout'
export { useGraphViewportLive } from './ui/useGraphViewportLive'

export {
  isGraphProfileEnabled,
  setGraphProfileEnabled,
  recordGraphClick,
} from './layout/graphViewportProfile'

export { isGraphInteracting, setGraphInteracting } from './noteGraphRuntime'

export {
  getSurfaceLayoutSnapshot,
  getTabSurfaceLayoutSnapshot,
  getSplitSurfaceLayoutSnapshot,
  subscribeSurfaceLayout,
  reportPanelContainerRect,
  reportTabSurfaceLayout,
  computePanelLayout,
  resetSurfaceLayoutRuntime,
} from './surfaceLayoutRuntime'
export type {
  SurfaceLayoutSnapshot,
  TabSurfaceLayoutSnapshot,
  SplitSurfaceLayoutSnapshot,
  SurfacePanelType,
  PanelLayoutRect,
} from './surfaceLayoutRuntime'

export {
  getSurfaceSplitLayout,
  beginSurfaceSplitDrag,
  setSurfaceSplitPreview,
  setSurfaceSplitIntent,
  commitSurfaceSplitLayout,
  cancelSurfaceSplitDrag,
  reportMainSplitAreaWidth,
  initSurfaceSplitLayoutRuntime,
  restoreSurfaceSplitLayoutFromStorage,
  resetSurfaceSplitLayoutRuntime,
  subscribeSurfaceSplitLayout,
  isSurfaceSplitDragging,
  isSurfaceResizing,
  getSurfaceSplitDragSession,
  applyKosRailWidthCss,
  SURFACE_SPLITTER_WIDTH_PX,
  SURFACE_RAIL_MIN_PX,
  SURFACE_RAIL_MAX_PX,
} from './layout/surfaceSplitLayoutRuntime'
export type { SurfaceSplitDragSession } from './layout/surfaceSplitLayoutRuntime'

export {
  freezeSplitGridColumns,
  beginRailDragCompositor,
  applyRailDragPreview,
  clearRailDragPreview,
  clearFrozenSplitGrid,
} from './layout/surfaceSplitDragPreview'

export {
  profileLayoutRecalc,
  setSurfaceSplitProfileEnabled,
  isSurfaceSplitProfileEnabled,
  isSurfaceSplitDeepProfileEnabled,
  beginDeepProfileDrag,
  endDeepProfileDrag,
  flushDeepProfileFrame,
} from './layout/surfaceSplitLayoutProfile'
export type { SurfaceSplitProfileSource } from './layout/surfaceSplitLayoutProfile'
export type { SurfaceSplitLayout, SurfaceSplitIntent } from './layout/surfaceSplitLayoutRuntime'

export { useSurfaceSplitLayout } from './ui/useSurfaceSplitLayout'

export { getGraphPanelLayout } from './graphPanelLayoutRuntime'

export {
  beginKnowledgeOSBoot,
  endKnowledgeOSBoot,
  isKnowledgeOSBooting,
  resetKnowledgeOSBoot,
} from './knowledgeOSBoot'

export {
  computeGraphLayout,
  computeGridLayoutFallback,
  GRAPH_LAYOUT_MIN_NODE_DISTANCE,
} from './layout/computeGraphLayout'
export { computeGraphBounds, type GraphBounds } from './layout/graphBounds'
export {
  screenToGraphWorld,
  findGraphNodeAtScreen,
  findGraphNodeAtWorld,
} from './layout/graphHitTest'

export {
  onBacklinkClick,
  backlinkIdForDoc,
  backlinkIdForInbound,
  backlinkIdForOutbound,
} from './backlinkNavigation'
export {
  activateGraphNode,
  activateGraphNodeForDocKey,
  commitActivation,
  flushPendingNodeActivationQueue,
  getActiveGraphNodeId,
  getPendingNodeActivationQueue,
  isNodeInCurrentSubgraph,
  requestNodeActivation,
  setActiveGraphNodeId,
  subscribeActiveGraphNode,
  subscribeNodeActivated,
  subscribeNodeRenderStable,
  getNodeActivationRenderState,
  subscribeNodeActivationRenderState,
  reportNodeRenderFrame,
  reportNodeRenderConvergenceFrame,
  getLastRenderStableConvergenceScore,
  resetGraphNodeActivationRuntime,
} from './graphNodeActivationRuntime'
export type {
  GraphRenderFrameSample,
  NodeActivationRenderState,
} from './graphNodeActivationRuntime'
export {
  buildGraphRenderFrameSample,
  getRenderConvergenceScore,
  isConvergenceScoreStable,
  isVisualBBoxStable,
  processRenderConvergenceFrame,
  resetRenderConvergenceTracker,
} from './graphRenderConvergence'
export {
  hasPendingGraphLayoutJobs,
  isGraphLayoutQuiescent,
  resetGraphLayoutDependencyRuntime,
} from './graphLayoutDependencyRuntime'
export type { NodeRenderStablePayload } from './graphNodeActivationRuntime'
export { ensureNodeInRenderedSubgraph } from './noteGraphRuntime'
export {
  getGraphNodeByDocKey,
  parseBacklinkIdToDocKey,
  resolveBacklinkTarget,
} from './graphIndex'
export {
  clearPendingGraphCenter,
  applyNavigationCoarseCenter,
  applyNavigationGraphFocus,
  centerCameraOnNodeForActivation,
  flushPendingGraphCenterWhenReady,
  flushPendingGraphNavigationCenter,
  getPendingGraphCenter,
  resetGraphNavigationRuntime,
  setPendingGraphCenter,
  tryApplyPendingGraphNavigationCenter,
} from './graphNavigationRuntime'
export {
  beginGraphNavigationReadiness,
  getGraphReadinessState,
  isGraphReady,
  isGraphLayoutReady,
  isGraphTopologyReady,
  notifyGraphLayoutReady,
  notifyGraphLayoutUnavailable,
  notifyGraphTopologyReady,
  resetGraphReadinessRuntime,
  subscribeGraphReadiness,
} from './graphReadinessRuntime'
export type { GraphReadinessState } from './graphReadinessRuntime'
export {
  getGraphCameraLockPhase,
  getLayoutQuietCounter,
  LAYOUT_QUIET_FRAME_THRESHOLD,
  notifyGraphLayoutComplete,
  notifyGraphTopologyRevisionChanged,
  overrideCameraLockOnce,
  overrideCameraLockForNavigationBurst,
  resetGraphCameraLock,
  shouldAllowAutoViewportCenter,
  shouldAllowExplicitViewportCenter,
} from './graphCameraLock'
export {
  commitFrameActivityToWindow,
  getLayoutActivityWindowAverage,
  getLayoutPhase,
  getLayoutPhysicsActivityWindow,
  hasRecentBurstActivity,
  isLayoutPhaseConverged,
  isPhysicsLowPassStable,
  LAYOUT_BURST_LOOKBACK_FRAMES,
  LAYOUT_BURST_SCORE_THRESHOLD,
  LAYOUT_PHYSICS_ACTIVITY_THRESHOLD,
  LAYOUT_PHYSICS_WINDOW_SIZE,
  LAYOUT_QUIET_DECLINE_FRAMES,
  markLayoutPhysicsActivity,
  markLayoutPhysicsIfNodePositionsChanged,
  resetLayoutPhysicsHeartbeat,
  wasLastCommittedFrameBurst,
} from './graphLayoutPhysicsHeartbeat'
export type { LayoutPhase, LayoutPhysicsActivityKind } from './graphLayoutPhysicsHeartbeat'
export { getRevisionStableFrameCount } from './graphCameraLock'
export type { GraphCameraLockPhase } from './graphCameraLock'

export {
  getGraphViewport,
  getGraphViewportSnapshot,
  centerGraphOnBoundsCenter,
  centerGraphOnDoc,
  centerGraphOnNode,
  requestExplicitGraphRecenter,
  centerGraphOnRouteNode,
  computeViewportCenterOnPoint,
  setGraphViewportIntent,
  projectGraphViewportAtTick,
  computeDeterministicFitView,
  computeViewportCenterOnNode,
  subscribeGraphViewport,
  resetGraphViewportRuntime,
} from './graphViewportRuntime'
export type {
  GraphViewport,
  GraphViewportCenterSource,
  GraphViewportIntent,
  GraphViewportSnapshot,
} from './graphViewportRuntime'
