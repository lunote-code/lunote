import { applyDistributedPatch } from './patchDispatcher'
import { enqueueReplicaPatch, reconcileReplicas, setReplicaPatchHandler } from './runtimeReplicaCoordinator'
import { schedulePatchApply } from './collaborationScheduler'
import { logPatchForReplay } from './collaborationReplayRuntime'
import type { DistributedRuntimePatch } from './types'

export type TransportSendFn = (patch: DistributedRuntimePatch) => void
export type TransportSubscribeFn = (handler: (patch: DistributedRuntimePatch) => void) => () => void

let sendFn: TransportSendFn | null = null
let unsubscribe: (() => void) | null = null
let connectedSessionId: string | null = null

export function registerCollaborationTransport(
  send: TransportSendFn,
  subscribe: TransportSubscribeFn,
): void {
  sendFn = send
  if (unsubscribe) unsubscribe()
  unsubscribe = subscribe((patch) => {
    ingestTransportPatch(patch)
  })
}

export function connectTransport(sessionId: string): void {
  connectedSessionId = sessionId
  setReplicaPatchHandler((patch) => {
    schedulePatchApply(patch, applyDistributedPatch)
  })
}

export function disconnectTransport(): void {
  connectedSessionId = null
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}

export function ingestTransportPatch(patch: DistributedRuntimePatch): void {
  logPatchForReplay(patch)
  enqueueReplicaPatch(patch)
  schedulePatchApply(patch, () => {
    reconcileReplicas()
  })
}

export function sendTransportPatch(patch: DistributedRuntimePatch): void {
  logPatchForReplay(patch)
  sendFn?.(patch)
}

export function isTransportConnected(): boolean {
  return connectedSessionId != null
}

export function resetCollaborationTransport(): void {
  disconnectTransport()
  sendFn = null
}
