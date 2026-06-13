/**
 * KCR external API + integration portal
 */
import { connectCollaborationSession, disconnectCollaborationSession } from './collaborationSessionRuntime'
import { registerCollaborationTransport, sendTransportPatch, ingestTransportPatch } from './collaborationTransportBridge'
import { setReplicaPatchHandler } from './runtimeReplicaCoordinator'
import { createDistributedPatch } from './collaborationPatchProtocol'
import { schedulePatchApply } from './collaborationScheduler'
import { applyDistributedPatch } from './patchDispatcher'
import { getCollaborationSnapshot, subscribeCollaborationSnapshot, restoreCollaborationSnapshot } from './collaborationSnapshotRuntime'
import { replayDistributedSnapshot } from './collaborationReplayRuntime'
import { recoverCollaborationSession, restoreDistributedSnapshot } from './collaborationRecoveryRuntime'
import { mountRemoteCursor, unmountRemoteCursor } from './collaborationCursorRuntime'
import { followRemoteUser } from './collaborativeNavigationRuntime'
import { broadcastWorkspacePatch } from './distributedWorkspaceRuntime'
import { resetCollaborationLifecycle } from './collaborationLifecycle'
import { resetCollaborationScheduler } from './collaborationScheduler'
import { resetCollaborationPresenceRuntime } from './collaborationPresenceRuntime'
import { resetCollaborationCursorRuntime } from './collaborationCursorRuntime'
import { resetCollaborationSelectionRuntime } from './collaborationSelectionRuntime'
import { resetDistributedWorkspaceRuntime } from './distributedWorkspaceRuntime'
import { resetDistributedGraphRuntime } from './distributedGraphRuntime'
import { resetCollaborativeNavigationRuntime } from './collaborativeNavigationRuntime'
import { resetRemoteViewportRuntime } from './remoteViewportRuntime'
import { resetCollaborationAwarenessRuntime } from './collaborationAwarenessRuntime'
import { resetCollaborationReplayRuntime } from './collaborationReplayRuntime'
import { resetCollaborationRecoveryRuntime } from './collaborationRecoveryRuntime'
import { resetCollaborationTransport } from './collaborationTransportBridge'
import { resetReplicaCoordinator } from './runtimeReplicaCoordinator'
import { resetCollaborationSnapshot } from './collaborationSnapshotRuntime'
import { resetDistributedClock } from './runtimeDistributedClock'
import { resetPatchProtocol } from './collaborationPatchProtocol'
import type { CollaborationSnapshot, DistributedRuntimePatch, PatchKind } from './types'
import type { TransportSendFn, TransportSubscribeFn } from './collaborationTransportBridge'

export { applyDistributedPatch }

export function initKnowledgeCollaborationRuntime(
  transport?: { send: TransportSendFn; subscribe: TransportSubscribeFn },
): void {
  setReplicaPatchHandler((patch) => {
    schedulePatchApply(patch, applyDistributedPatch)
  })
  if (transport) registerCollaborationTransport(transport.send, transport.subscribe)
}

export function enqueueDistributedPatch(patch: DistributedRuntimePatch): void {
  ingestTransportPatch(patch)
}

export function publishLocalPatch(kind: PatchKind, payload: unknown): void {
  const patch = createDistributedPatch(kind, payload)
  sendTransportPatch(patch)
  schedulePatchApply(patch, applyDistributedPatch)
}

export {
  connectCollaborationSession,
  disconnectCollaborationSession,
  getCollaborationSnapshot,
  subscribeCollaborationSnapshot,
  restoreCollaborationSnapshot,
  replayDistributedSnapshot,
  recoverCollaborationSession,
  restoreDistributedSnapshot,
  mountRemoteCursor,
  unmountRemoteCursor,
  followRemoteUser,
  broadcastWorkspacePatch,
}

export function resetKnowledgeCollaborationRuntime(): void {
  disconnectCollaborationSession()
  resetCollaborationTransport()
  resetReplicaCoordinator()
  resetCollaborationSnapshot()
  resetDistributedClock()
  resetPatchProtocol()
  resetCollaborationLifecycle()
  resetCollaborationScheduler()
  resetCollaborationPresenceRuntime()
  resetCollaborationCursorRuntime()
  resetCollaborationSelectionRuntime()
  resetDistributedWorkspaceRuntime()
  resetDistributedGraphRuntime()
  resetCollaborativeNavigationRuntime()
  resetRemoteViewportRuntime()
  resetCollaborationAwarenessRuntime()
  resetCollaborationReplayRuntime()
  resetCollaborationRecoveryRuntime()
}

export type { CollaborationSnapshot, DistributedRuntimePatch }
