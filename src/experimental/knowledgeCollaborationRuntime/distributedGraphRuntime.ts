import { bumpGraphEpoch } from './collaborationSnapshotRuntime'
import { createDistributedPatch } from './collaborationPatchProtocol'
import { scheduleContextGraphUpdate } from '../../editor/knowledgeInteractionRuntime'
import type { DocKey } from '../../editor/knowledgeRuntime/types'

export type GraphPatchPayload = {
  centerDocKey: DocKey
  edgeAdded?: Array<{ from: string; to: string; kind: string }>
  edgeRemoved?: string[]
  viewport?: { x: number; y: number; zoom: number }
}

const pendingGraphPatches = new Map<DocKey, GraphPatchPayload[]>()

export function applyDistributedGraphPatch(payload: GraphPatchPayload, fromRemote: boolean): void {
  const list = pendingGraphPatches.get(payload.centerDocKey) ?? []
  list.push(payload)
  pendingGraphPatches.set(payload.centerDocKey, list)

  if (fromRemote) {
    bumpGraphEpoch()
    scheduleContextGraphUpdate(payload.centerDocKey, () => {
      /* snapshot via KIR */
    })
  }
}

export function broadcastGraphPatch(payload: GraphPatchPayload): ReturnType<typeof createDistributedPatch> {
  return createDistributedPatch('graph', payload)
}

export function getPendingGraphPatches(docKey: DocKey): GraphPatchPayload[] {
  return pendingGraphPatches.get(docKey) ?? []
}

export function clearGraphPatches(docKey: DocKey): void {
  pendingGraphPatches.delete(docKey)
}

export function resetDistributedGraphRuntime(): void {
  pendingGraphPatches.clear()
}
