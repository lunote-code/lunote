/**
 * Knowledge Collaboration Runtime (KCR) — distributed multiplayer knowledge workspace.
 *
 * Transport → Patch Queue → Replica Coordinator → Snapshot → React (observers only)
 */

export type * from './types'

export {
  connectCollaborationSession,
  disconnectCollaborationSession,
  enqueueDistributedPatch,
  applyDistributedPatch,
  publishLocalPatch,
  subscribeCollaborationSnapshot,
  getCollaborationSnapshot,
  mountRemoteCursor,
  unmountRemoteCursor,
  followRemoteUser,
  broadcastWorkspacePatch,
  replayDistributedSnapshot,
  restoreDistributedSnapshot,
  recoverCollaborationSession,
  initKnowledgeCollaborationRuntime,
  resetKnowledgeCollaborationRuntime,
} from './knowledgeCollaborationBridge'

export {
  registerCollaborationTransport,
  sendTransportPatch,
  ingestTransportPatch,
  isTransportConnected,
} from './collaborationTransportBridge'

export {
  joinPresence,
  getPresenceRecords,
  updatePresence,
  leavePresence,
} from './collaborationPresenceRuntime'

export {
  getRemoteCursors,
  broadcastCursorPatch,
} from './collaborationCursorRuntime'

export {
  getRemoteSelections,
  shouldApplyRemoteSelection,
  broadcastSelectionPatch,
} from './collaborationSelectionRuntime'

export {
  broadcastGraphPatch,
  applyDistributedGraphPatch,
} from './distributedGraphRuntime'

export {
  getVectorClock,
  getLocalActorId,
  tickLogicalClock,
} from './runtimeDistributedClock'

export { createDistributedPatch } from './collaborationPatchProtocol'
