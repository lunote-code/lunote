import { applyAwarenessPatch } from './collaborationAwarenessRuntime'
import { applyRemoteCursorPatch } from './collaborationCursorRuntime'
import { applyRemoteSelectionPatch } from './collaborationSelectionRuntime'
import { applyWorkspacePatch } from './distributedWorkspaceRuntime'
import { applyDistributedGraphPatch } from './distributedGraphRuntime'
import { applyNavigationPatch } from './collaborativeNavigationRuntime'
import { applyRemoteViewportPatch } from './remoteViewportRuntime'
import { joinPresence } from './collaborationPresenceRuntime'
import type { DistributedRuntimePatch } from './types'

export function applyDistributedPatch(patch: DistributedRuntimePatch): void {
  const payload = patch.payload
  const fromRemote = patch.actorId !== undefined

  switch (patch.kind) {
    case 'awareness':
      applyAwarenessPatch(patch)
      break
    case 'cursor':
      applyRemoteCursorPatch(payload as Parameters<typeof applyRemoteCursorPatch>[0])
      break
    case 'selection':
      applyRemoteSelectionPatch(payload as Parameters<typeof applyRemoteSelectionPatch>[0])
      break
    case 'workspace':
      applyWorkspacePatch(payload as Parameters<typeof applyWorkspacePatch>[0], fromRemote)
      break
    case 'graph':
      applyDistributedGraphPatch(payload as Parameters<typeof applyDistributedGraphPatch>[0], fromRemote)
      break
    case 'navigation':
      applyNavigationPatch(payload as Parameters<typeof applyNavigationPatch>[0])
      break
    case 'viewport':
      applyRemoteViewportPatch(payload as Parameters<typeof applyRemoteViewportPatch>[0])
      break
    case 'block':
      break
    case 'overlay':
      break
    default:
      if ((payload as { displayName?: string })?.displayName) {
        joinPresence(patch.actorId, (payload as { displayName: string }).displayName)
      }
  }
}
