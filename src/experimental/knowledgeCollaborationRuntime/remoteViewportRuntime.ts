import { createDistributedPatch } from './collaborationPatchProtocol'
import { updateViewportsSnapshot } from './collaborationSnapshotRuntime'
import type { RemoteViewport } from './types'
import type { DocKey } from '../../editor/knowledgeRuntime/types'

const viewports = new Map<string, RemoteViewport>()

export function applyRemoteViewportPatch(payload: {
  actorId: string
  docKey?: DocKey | null
  x: number
  y: number
  zoom: number
  scrollTop: number
}): void {
  viewports.set(payload.actorId, {
    actorId: payload.actorId,
    docKey: payload.docKey ?? null,
    x: payload.x,
    y: payload.y,
    zoom: payload.zoom,
    scrollTop: payload.scrollTop,
  })
  updateViewportsSnapshot([...viewports.values()])
}

export function getRemoteViewports(): RemoteViewport[] {
  return [...viewports.values()]
}

export function broadcastViewportPatch(
  docKey: DocKey | null,
  viewport: { x: number; y: number; zoom: number; scrollTop: number },
): ReturnType<typeof createDistributedPatch> {
  return createDistributedPatch('viewport', { docKey, ...viewport })
}

export function resetRemoteViewportRuntime(): void {
  viewports.clear()
}
