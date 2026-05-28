/**
 * Knowledge Interaction Runtime (KIR) — context-aware knowledge UX on top of Knowledge Runtime.
 *
 * Knowledge Runtime → KIR → Context Surfaces → React UI (observers only)
 */

export type * from './types'

export {
  emitInteractionEvent,
  subscribeInteractionEvents,
  getInteractionEventRevision,
  resetInteractionEvents,
} from './interactionEvents'
export type { InteractionEvent, InteractionEventKind } from './interactionEvents'

export {
  ContextLruCache,
  previewCache,
  snippetCache,
  rankCache,
  graphNeighborhoodCache,
  mentionCandidateCache,
  resetContextCaches,
} from './contextCache'

export {
  scheduleInteractionTask,
  cancelInteractionTasksByPrefix,
  drainInteractionQueue,
  bumpInteractionGeneration,
  resetInteractionScheduler,
} from './interactionScheduler'
export type { InteractionTask, InteractionTaskKind } from './interactionScheduler'

export { rankSemanticHit, compareSemanticRank } from './semanticRankRuntime'

export {
  truncatePreviewMarkdown,
  buildPreviewFragment,
  schedulePreviewHydration,
  resetPreviewVirtualization,
} from './previewVirtualization'

export {
  setKnowledgeContentResolver,
  resolvePreviewTarget,
  getCachedPreview,
  startHoverPreview,
  endHoverPreview,
  resetHoverPreviewRuntime,
} from './hoverPreviewRuntime'
export type { ContentResolver } from './hoverPreviewRuntime'

export {
  setBacklinkContentResolver,
  getBacklinkSurfaceSync,
  loadBacklinkSurfaceAsync,
  resetBacklinkSurfaceRuntime,
} from './backlinkSurfaceRuntime'

export {
  buildContextGraphIncremental,
  scheduleContextGraphUpdate,
  getVisibleContextNodes,
  setContextGraphFocusMode,
  resetContextGraphRuntime,
} from './contextGraphRuntime'
export type { ContextGraphSnapshot } from './contextGraphRuntime'

export { searchSemanticAsync, resetSemanticSearchRuntime } from './semanticSearchRuntime'
export type { SemanticSearchOptions } from './semanticSearchRuntime'

export {
  registerTermsFromDocument,
  unregisterDocumentTerms,
  findUnlinkedMentionsIncremental,
  scheduleMentionScan,
  resetUnlinkedMentionRuntime,
} from './unlinkedMentionRuntime'

export {
  getRelatedNotesSync,
  scheduleKnowledgeSuggestions,
  resetKnowledgeSuggestionRuntime,
} from './knowledgeSuggestionRuntime'

export {
  resolveNavigationTarget,
  goToDefinition,
  navigateBack,
  navigateForward,
  getBreadcrumb,
  getJumpHistory,
  getActiveContextDocKey,
  selectBacklink,
  resetKnowledgeNavigationRuntime,
} from './knowledgeNavigationRuntime'
export type { NavigationTarget } from './knowledgeNavigationRuntime'

export {
  openPeek,
  closePeek,
  peekDefinition,
  peekReferences,
  cmdClickWikiLink,
  getPeekPreview,
  getOpenPeeks,
  resetKnowledgePeekRuntime,
} from './knowledgePeekRuntime'
export type { PeekState } from './knowledgePeekRuntime'

export {
  createContextSurface,
  getContextSurface,
  showContextSurface,
  hideContextSurface,
  hydrateContextSurface,
  listContextSurfaces,
  destroyContextSurface,
  resetContextSurfaceRuntime,
} from './contextSurfaceRuntime'

export {
  initKnowledgeInteractionRuntime,
  onKirDocumentIndexed,
  onKirDocumentRemoved,
  resetKnowledgeInteractionRuntime,
  setKirContentResolver,
} from './kirBridge'
