import { isAnySelectionLocked, isSelectionLocked } from '../nativeInput/selectionCycle'
import { createDistributedPatch } from './collaborationPatchProtocol'
import { updateSelectionsSnapshot } from './collaborationSnapshotRuntime'
import { getLocalActorId } from './runtimeDistributedClock'
import type { RemoteCursor } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

const selections = new Map<string, RemoteCursor>()

/** Reject remote selection override when local native textarea is locked*/
export function shouldApplyRemoteSelection(actorId: string, targetBlockId?: string | null): boolean {
  if (actorId === getLocalActorId()) return false
  if (isAnySelectionLocked()) return false
  if (targetBlockId && typeof globalThis.document !== 'undefined') {
    const ta = globalThis.document.querySelector<HTMLTextAreaElement>(
      `textarea[data-mermaid-block-id="${targetBlockId}"]`,
    )
    if (ta && isSelectionLocked(ta)) return false
  }
  return true
}

export function applyRemoteSelectionPatch(payload: {
  actorId: string
  docKey?: DocKey | null
  blockId?: string | null
  start: number
  end: number
  surface?: RemoteCursor['surface']
}): void {
  if (!shouldApplyRemoteSelection(payload.actorId, payload.blockId)) return

  const prev = selections.get(payload.actorId)
  selections.set(payload.actorId, {
    actorId: payload.actorId,
    docKey: payload.docKey ?? null,
    blockId: payload.blockId ?? null,
    start: payload.start,
    end: payload.end,
    surface: payload.surface ?? 'pm',
    revision: (prev?.revision ?? 0) + 1,
  })
  updateSelectionsSnapshot([...selections.values()])
}

export function getRemoteSelections(): RemoteCursor[] {
  return [...selections.values()]
}

export function broadcastSelectionPatch(
  docKey: DocKey | null,
  start: number,
  end: number,
  surface: RemoteCursor['surface'],
  blockId?: string | null,
): ReturnType<typeof createDistributedPatch> {
  return createDistributedPatch('selection', { docKey, blockId, start, end, surface })
}

export function resetCollaborationSelectionRuntime(): void {
  selections.clear()
}
