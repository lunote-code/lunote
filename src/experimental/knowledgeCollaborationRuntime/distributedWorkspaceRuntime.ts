import { createDistributedPatch } from './collaborationPatchProtocol'
import { bumpWorkspaceEpoch } from './collaborationSnapshotRuntime'
import { notifyContextWorkspaceChanged } from '../../editor/knowledgeSurfaceRuntime/contextWorkspaceRuntime'
import type { WorkspaceLayoutSnapshot } from '../../editor/knowledgeSurfaceRuntime/types'

let remoteLayout: Partial<WorkspaceLayoutSnapshot> | null = null
let localLayoutEpoch = 0

export type WorkspacePatchPayload = {
  activeSurfaceId?: string | null
  graphViewport?: { x: number; y: number; zoom: number }
  followActorId?: string | null
}

export function applyWorkspacePatch(payload: WorkspacePatchPayload, fromRemote: boolean): void {
  remoteLayout = { ...remoteLayout, ...payload }
  if (fromRemote) {
    bumpWorkspaceEpoch()
    notifyContextWorkspaceChanged()
  }
}

export function broadcastWorkspacePatch(payload: WorkspacePatchPayload): ReturnType<typeof createDistributedPatch> {
  localLayoutEpoch += 1
  return createDistributedPatch('workspace', { ...payload, epoch: localLayoutEpoch })
}

export function getMergedWorkspaceHints(): WorkspacePatchPayload {
  return remoteLayout ?? {}
}

export function resetDistributedWorkspaceRuntime(): void {
  remoteLayout = null
  localLayoutEpoch = 0
}
