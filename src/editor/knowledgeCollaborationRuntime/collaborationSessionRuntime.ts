import {
  createCollaborationSession,
  destroyCollaborationSession,
  getCollaborationSession,
  transitionCollaborationPhase,
} from './collaborationLifecycle'
import { setDistributedClockActor, resetDistributedClock } from './runtimeDistributedClock'
import { resetReplicaCoordinator } from './runtimeReplicaCoordinator'
import { resetCollaborationSnapshot } from './collaborationSnapshotRuntime'
import { connectTransport, disconnectTransport } from './collaborationTransportBridge'
import type { CollaborationSession } from './types'

export function connectCollaborationSession(
  sessionId: string,
  vaultId: string,
  localActorId: string,
): CollaborationSession {
  const session = createCollaborationSession(sessionId, vaultId, localActorId)
  setDistributedClockActor(localActorId)
  connectTransport(sessionId)
  transitionCollaborationPhase('synchronizing')
  scheduleActivate()
  return session
}

function scheduleActivate(): void {
  queueMicrotask(() => {
    const s = getCollaborationSession()
    if (s?.phase === 'synchronizing') transitionCollaborationPhase('active')
  })
}

export function disconnectCollaborationSession(): void {
  disconnectTransport()
  destroyCollaborationSession()
}

export function getActiveCollaborationSession(): CollaborationSession | null {
  return getCollaborationSession()
}

export function resetCollaborationSessionRuntime(): void {
  disconnectCollaborationSession()
  resetDistributedClock()
  resetReplicaCoordinator()
  resetCollaborationSnapshot()
}
