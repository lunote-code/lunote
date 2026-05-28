import type { CollaborationPhase, CollaborationSession } from './types'

const VALID: Record<CollaborationPhase, CollaborationPhase[]> = {
  connecting: ['synchronizing', 'offline', 'destroyed'],
  synchronizing: ['active', 'degraded', 'offline', 'destroyed'],
  active: ['degraded', 'offline', 'recovering', 'destroyed'],
  degraded: ['active', 'offline', 'recovering', 'destroyed'],
  offline: ['connecting', 'recovering', 'destroyed'],
  recovering: ['synchronizing', 'active', 'offline', 'destroyed'],
  destroyed: [],
}

let session: CollaborationSession | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function getCollaborationSession(): CollaborationSession | null {
  return session
}

export function transitionCollaborationPhase(phase: CollaborationPhase): CollaborationSession | null {
  if (!session) return null
  if (!VALID[session.phase]?.includes(phase)) return session
  session = { ...session, phase }
  notify()
  return session
}

export function createCollaborationSession(
  sessionId: string,
  vaultId: string,
  localActorId: string,
): CollaborationSession {
  session = {
    sessionId,
    vaultId,
    localActorId,
    phase: 'connecting',
    connectedAt: performance.now(),
  }
  notify()
  return session
}

export function destroyCollaborationSession(): void {
  if (session) {
    session = { ...session, phase: 'destroyed' }
    notify()
    session = null
  }
}

export function subscribeCollaborationLifecycle(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetCollaborationLifecycle(): void {
  session = null
  listeners.clear()
}
