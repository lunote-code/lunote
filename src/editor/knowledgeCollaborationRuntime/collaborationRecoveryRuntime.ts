import { transitionCollaborationPhase } from './collaborationLifecycle'
import { bumpReconciliationEpoch } from './runtimeDistributedClock'
import { resetReplicaCoordinator, reconcileReplicas } from './runtimeReplicaCoordinator'
import { replayFromLog } from './collaborationReplayRuntime'
import { connectTransport, disconnectTransport } from './collaborationTransportBridge'
import type { DistributedRuntimePatch } from './types'

export function recoverCollaborationSession(
  sessionId: string,
  apply: (patch: DistributedRuntimePatch) => void,
): void {
  transitionCollaborationPhase('recovering')
  disconnectTransport()
  bumpReconciliationEpoch()
  resetReplicaCoordinator()
  connectTransport(sessionId)
  replayFromLog(apply)
  reconcileReplicas()
  transitionCollaborationPhase('synchronizing')
  queueMicrotask(() => transitionCollaborationPhase('active'))
}

export function restoreDistributedSnapshot(
  apply: (patch: DistributedRuntimePatch) => void,
): void {
  recoverCollaborationSession('recovery', apply)
}

export function resetCollaborationRecoveryRuntime(): void {
  /* stateless */
}
