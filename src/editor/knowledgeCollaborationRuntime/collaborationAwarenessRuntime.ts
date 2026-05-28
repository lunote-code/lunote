import { applyRemoteCursorPatch } from './collaborationCursorRuntime'
import { applyRemoteSelectionPatch } from './collaborationSelectionRuntime'
import { joinPresence, updatePresence } from './collaborationPresenceRuntime'
import type { DistributedRuntimePatch } from './types'

export function applyAwarenessPatch(patch: DistributedRuntimePatch): void {
  const payload = patch.payload as {
    actorId?: string
    displayName?: string
    phase?: string
    hover?: { docKey?: string; start?: number; end?: number }
    selection?: { docKey?: string; blockId?: string; start: number; end: number }
  }
  if (!payload?.actorId) return

  if (payload.displayName) joinPresence(payload.actorId, payload.displayName)
  if (payload.phase) updatePresence(payload.actorId, { phase: payload.phase as never })

  if (payload.hover) {
    applyRemoteCursorPatch({
      actorId: payload.actorId,
      docKey: payload.hover.docKey ?? null,
      start: payload.hover.start ?? 0,
      end: payload.hover.end ?? 0,
      surface: 'pm',
    })
  }

  if (payload.selection) {
    applyRemoteSelectionPatch({
      actorId: payload.actorId,
      docKey: payload.selection.docKey ?? null,
      blockId: payload.selection.blockId ?? null,
      start: payload.selection.start,
      end: payload.selection.end,
    })
  }
}

export function resetCollaborationAwarenessRuntime(): void {
  /* state in submodules */
}
