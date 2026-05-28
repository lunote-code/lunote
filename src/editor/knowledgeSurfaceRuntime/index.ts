/**
 * Knowledge Surface Runtime (KSR) — IDE-grade knowledge workspace surfaces.
 *
 * Knowledge Runtime → KIR → KSR → React (snapshot subscribers only)
 */

export type * from './types'

export {
  registerSurfaceRecord,
  getSurfaceSnapshot,
  listSurfaceSnapshots,
  subscribeSurface,
  subscribeAllSurfaces,
  transitionSurfacePhase,
  destroySurfaceRecord,
  getSurfaceGlobalRevision,
  resetSurfaceLifecycle,
} from './surfaceLifecycle'

export {
  scheduleSurfaceTask,
  cancelSurfaceTasksByPrefix,
  drainSurfaceQueue,
  resetSurfaceScheduler,
} from './surfaceScheduler'

export {
  virtualizeSurface,
  computeVirtualWindow,
  sliceVirtualItems,
  getSurfaceVirtualWindow,
  resetSurfaceVirtualization,
} from './surfaceVirtualization'

export {
  registerSurface,
  mountDockSurface,
  moveSurfaceToDock,
  detachSurface,
  pinSurface,
  getDockSnapshot,
  subscribeDockRuntime,
  subscribeDockAndSurfaces,
  resetWorkspaceDockRuntime,
} from './workspaceDockRuntime'

export {
  serializeWorkspaceLayout,
  restoreWorkspaceLayout,
  getWorkspaceLayoutSnapshot,
  setActiveSurface,
  setSplitTree,
  setLayoutGraphViewport,
  subscribeLayoutRuntime,
  resetWorkspaceLayoutRuntime,
} from './workspaceLayoutRuntime'

export {
  showHoverSurface,
  hideHoverSurface,
  getHoverSurfaceSnapshot,
  subscribeHoverSurface,
  ensureHoverSurfaceListening,
  resetHoverSurfaceRuntime,
} from './hoverSurfaceRuntime'

export {
  openPeekSurface,
  closePeekSurface,
  getPeekSurfaceSnapshot,
  handleWikiCmdClick,
  subscribePeekSurface,
  resetPeekSurfaceRuntime,
} from './peekSurfaceRuntime'

export {
  mountKnowledgeSidebar,
  refreshSidebarAsync,
  getSidebarSnapshot,
  getVirtualizedBacklinkItems,
  subscribeKnowledgeSidebar,
  resetKnowledgeSidebarRuntime,
} from './knowledgeSidebarRuntime'

export {
  mountGraphSurface,
  getGraphSurfaceSnapshot,
  scheduleGraphSurfaceUpdate,
  updateGraphSurfaceViewport,
  subscribeGraphSurface,
  resetGraphSurfaceRuntime,
} from './graphSurfaceRuntime'

export {
  mountSearchSurface,
  updateSearchQuery,
  getSearchSurfaceSnapshot,
  getVirtualizedSearchResults,
  subscribeSearchSurface,
  resetSearchSurfaceRuntime,
} from './searchSurfaceRuntime'

export {
  openCommandPalette,
  closeCommandPalette,
  updatePaletteQuery,
  handlePaletteShortcut,
  getCommandPaletteSnapshot,
  getVirtualizedPaletteItems,
  subscribeCommandPalette,
  resetCommandPaletteRuntime,
} from './commandPaletteRuntime'

export {
  mountOverlay,
  hideOverlay,
  destroyOverlay,
  getOverlayStack,
  destroyAllOverlays,
  subscribeKnowledgeOverlay,
  resetKnowledgeOverlayRuntime,
} from './knowledgeOverlayRuntime'

export {
  navigateToKnowledgeTarget,
  navigationGoBack,
  navigationGoForward,
  getNavigationBreadcrumb,
  getNavigationStack,
  scheduleContextJump,
  graphJumpToDoc,
  subscribeNavigationSurface,
  resetNavigationSurfaceRuntime,
} from './navigationSurfaceRuntime'

export {
  initContextWorkspace,
  getContextWorkspaceSnapshot,
  subscribeContextWorkspace,
  resetContextWorkspaceRuntime,
} from './contextWorkspaceRuntime'

export {
  initKnowledgeSurfaceRuntime,
  onKsrWorkspaceOpened,
  setKsrContentResolver,
  resetKnowledgeSurfaceRuntime,
} from './knowledgeSurfaceBridge'
