/**
 * Knowledge Runtime Layer — Obsidian-like local-first knowledge base on top of Document Runtime OS.
 *
 * Filesystem → Vault → Incremental Index → Link Graph → Workspace → UI
 */

export type * from './types'

export {
  emitKnowledgeEvent,
  getKnowledgeEventRevision,
  subscribeKnowledgeEvents,
  resetKnowledgeEvents,
} from './knowledgeEvents'
export type { KnowledgeEvent, KnowledgeEventKind } from './knowledgeEvents'

export {
  hasUnresolvedPrefix,
  normalizeDocKeyForComparison,
  normalizeDocKeyForNavigation,
  stripUnresolvedPrefix,
} from './docKeyNormalization'

export {
  registerDocumentMeta,
  unregisterDocument,
  getDocumentMeta,
  getDocumentMetaByPath,
  resolveDocKey,
  listDocumentKeys,
  listDocumentMetas,
  getActiveVault,
  getKnowledgeRegistryRevision,
  resetKnowledgeRegistry,
} from './knowledgeRegistry'

export {
  parseDocumentKnowledge,
  parseWikiLinksInText,
  parseBlockRefsInText,
  parseFrontmatter,
  docKeyFromWikiTarget,
  unescapeWikiLinksInMarkdown,
} from './wikiLinkParser'

export {
  registerHeadingTargets,
  unregisterHeadingTargets,
  resolveHeadingTarget,
  resolveHeadingLineInDocument,
  listHeadingCanonicalsForHost,
  resetHeadingLinkTargets,
} from './headingLinkTargets'
export type { HeadingTarget } from './headingLinkTargets'

export {
  canonicalizeWikiLinkText,
  canonicalizeWikiSegment,
  normalizeWikiPath,
} from './wikiCanonical'

export {
  resolveWikiLinkTarget,
  linkTargetMatchesDoc,
  canonicalDocKeyForGraph,
} from './wikiLinkResolver'

export {
  hashContent,
  isDocumentIndexStale,
  markDocumentIndexed,
  getIndexedContentHash,
  resetKnowledgeIndex,
} from './knowledgeIndex'

export {
  parseChangedDocument,
  drainIndexerQueue,
  indexDocumentContent,
  removeDocumentFromIndex,
  setIndexerVaultRoot,
  resetIncrementalIndexer,
  flushBootstrapPendingDocuments,
} from './incrementalIndexer'

export {
  openVault,
  closeVault,
  getActiveVaultSession,
  getVaultRootDir,
  absolutePathToDocKey,
  vaultIdFromRoot,
  notifyDocumentAdded,
  notifyDocumentRenamed,
  resetKnowledgeRuntime,
} from './vaultRuntime'

export {
  getGraphSnapshot,
  getIncomingEdges,
  getOutgoingEdges,
  rebuildEdgesForDocument,
  rebuildEdgesFromLinkRefs,
  rebuildGraphEdgesFromLinkIndex,
  resetLinkGraph,
} from './linkGraph'

export { finalizeLinkGraphSync } from './linkGraphSync'

export {
  getIncomingLinkRefs,
  getIncomingLinkRefsForDocPanel,
  getIncomingLinkCount,
  getLinkGraphIndexRevision,
  getOutgoingLinkRefs,
  linkRefsFromParsedWikiLinks,
  checkLinkGraphIndexInvariants,
  rebuildLinkGraphIndexForDocument,
  rebuildIncomingFromOutgoing,
  refreshAllLinkRefsFromRegistry,
  linkIncomingStorageKey,
  linkIncomingLookupKeys,
  removeLinkGraphIndexForDocument,
  resolveLinkTargetDocKey,
  resetLinkGraphIndex,
  getLinkGraphEdgeCounts,
  listOutgoingDocKeys,
} from './linkGraphIndex'
export type { LinkRef } from './linkGraphIndex'
export type { LinkGraphIndexInvariantReport } from './linkGraphIndex'

export {
  getLinkIndexState,
  setLinkIndexState,
  subscribeLinkIndexState,
  markLinkIndexUpdating,
  markLinkIndexReadyIfUpdating,
} from './linkIndexState'
export type { LinkIndexState } from './linkIndexState'

export {
  bootstrapWorkspaceLinkGraphIndex,
  resetWorkspaceLinkGraphBootstrap,
  scanAllDocuments,
  waitForLinkIndexReady,
} from './workspaceLinkGraphBootstrap'

export {
  getBacklinksForDoc,
  rebuildBacklinksForTarget,
  propagateDocumentRename,
  resetBacklinkEngine,
} from './backlinkEngine'

export {
  resolveCanonicalIdentity,
} from './canonicalIdentity'
export type { CanonicalDocIdentity } from './canonicalIdentity'

export {
  getDocumentsByTag,
  listAllTags,
  indexTagsForDocument,
  resetTagIndex,
} from './tagIndex'

export {
  resolveBlockAnchor,
  resolveBlockLineInDocument,
  registerBlockRefs,
  unregisterBlockRefs,
  resetBlockReferenceIndex,
} from './blockReference'

export {
  resolveEmbedLink,
  canMountEmbed,
  resetEmbedRuntime,
} from './embedRuntime'
export type { EmbedResolveResult } from './embedRuntime'

export {
  searchKnowledgeAsync,
  upsertSearchIndexEntry,
  resolveSearchTarget,
  rebuildSearchIndexFromRegistry,
  resetSearchRuntime,
} from './searchRuntime'

export {
  bindWorkspaceVault,
  openDocumentTab,
  activateTab,
  closeTab,
  getActiveTab,
  getWorkspaceState,
  setGraphViewport as setWorkspaceGraphViewport,
  serializeWorkspaceSession,
  restoreWorkspaceSession,
  resetWorkspaceRuntime,
} from './workspaceRuntime'
export type { WorkspaceTab, WorkspacePane, WorkspaceState } from './workspaceRuntime'

export {
  refreshGraphViewIncremental,
  subscribeGraphView,
  getGraphViewState,
  setGraphViewport,
  getVisibleNodes,
  scheduleGraphLayoutTick,
  ensureGraphRuntimeListening,
  resetGraphRuntime,
} from './graphRuntime'
export type { GraphLayoutNode, GraphViewState } from './graphRuntime'

export {
  onKnowledgeDocumentOpened,
  onKnowledgeDocumentSaved,
  onKnowledgeDocumentRenamed,
  onKnowledgeDocumentRemoved,
  onKnowledgeWorkspaceOpened,
} from './knowledgeBridge'
