import { createDistributedPatch } from './collaborationPatchProtocol'
import { updatePresenceSnapshot } from './collaborationSnapshotRuntime'
import { scheduleCollabTask } from './collaborationScheduler'
import type { PresencePhase, PresenceRecord } from './types'
const presence = new Map<string, PresenceRecord>()
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

function colorFor(actorId: string): string {
  let h = 0
  for (let i = 0; i < actorId.length; i++) h = (h * 31 + actorId.charCodeAt(i)) | 0
  return COLORS[Math.abs(h) % COLORS.length]!
}

export function joinPresence(actorId: string, displayName: string): PresenceRecord {
  const record: PresenceRecord = {
    actorId,
    displayName,
    phase: 'join',
    activeDocKey: null,
    activeBlockId: null,
    lastSeen: performance.now(),
    color: colorFor(actorId),
  }
  presence.set(actorId, record)
  flushPresence('idle')
  return record
}

export function updatePresence(
  actorId: string,
  patch: Partial<Pick<PresenceRecord, 'phase' | 'activeDocKey' | 'activeBlockId'>>,
): void {
  const prev = presence.get(actorId)
  if (!prev) return
  presence.set(actorId, {
    ...prev,
    ...patch,
    lastSeen: performance.now(),
  })
  scheduleCollabTask({
    key: `presence:${actorId}`,
    priority: 'idle',
    run: () => flushPresence('idle'),
  })
}

export function setPresencePhase(actorId: string, phase: PresencePhase): void {
  updatePresence(actorId, { phase })
}

export function leavePresence(actorId: string): void {
  const prev = presence.get(actorId)
  if (prev) {
    presence.set(actorId, { ...prev, phase: 'destroyed' })
    presence.delete(actorId)
  }
  flushPresence('idle')
}

function flushPresence(_priority: 'idle' | 'background'): void {
  const now = performance.now()
  for (const [id, rec] of presence) {
    if (now - rec.lastSeen > 60_000 && rec.phase !== 'offline') {
      presence.set(id, { ...rec, phase: 'offline' })
    }
  }
  updatePresenceSnapshot([...presence.values()])
}

export function getPresenceRecords(): PresenceRecord[] {
  return [...presence.values()]
}

export function createPresenceAwarenessPatch(actorId: string): ReturnType<typeof createDistributedPatch> {
  const rec = presence.get(actorId)
  return createDistributedPatch('awareness', rec ?? { actorId })
}

export function resetCollaborationPresenceRuntime(): void {
  presence.clear()
}
