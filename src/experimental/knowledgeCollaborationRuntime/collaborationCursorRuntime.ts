import { isAnySelectionLocked } from '../../editor/nativeInput/selectionCycle'
import { createDistributedPatch } from './collaborationPatchProtocol'
import { getLocalActorId } from './runtimeDistributedClock'
import { updateCursorsSnapshot } from './collaborationSnapshotRuntime'
import type { RemoteCursor } from './types'
import type { DocKey } from '../../editor/knowledgeRuntime/types'

const cursors = new Map<string, RemoteCursor>()
const mounted = new Set<string>()

export function mountRemoteCursor(actorId: string): void {
  mounted.add(actorId)
}

export function unmountRemoteCursor(actorId: string): void {
  mounted.delete(actorId)
  cursors.delete(actorId)
  flushCursors()
}

export function applyRemoteCursorPatch(payload: {
  actorId: string
  docKey?: DocKey | null
  blockId?: string | null
  start: number
  end: number
  surface?: RemoteCursor['surface']
}): void {
  if (payload.actorId === getLocalActorId() && isAnySelectionLocked()) return

  const prev = cursors.get(payload.actorId)
  const next: RemoteCursor = {
    actorId: payload.actorId,
    docKey: payload.docKey ?? null,
    blockId: payload.blockId ?? null,
    start: payload.start,
    end: payload.end,
    surface: payload.surface ?? 'pm',
    revision: (prev?.revision ?? 0) + 1,
  }
  cursors.set(payload.actorId, next)
  flushCursors()
}

function flushCursors(): void {
  updateCursorsSnapshot([...cursors.values()].filter((c) => mounted.has(c.actorId) || mounted.size === 0))
}

export function getRemoteCursors(): RemoteCursor[] {
  return [...cursors.values()]
}

export function broadcastCursorPatch(
  docKey: DocKey | null,
  start: number,
  end: number,
  surface: RemoteCursor['surface'],
  blockId?: string | null,
): ReturnType<typeof createDistributedPatch> {
  return createDistributedPatch('cursor', { docKey, blockId, start, end, surface })
}

export function resetCollaborationCursorRuntime(): void {
  cursors.clear()
  mounted.clear()
}
