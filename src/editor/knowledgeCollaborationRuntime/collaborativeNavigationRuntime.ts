import { createDistributedPatch } from './collaborationPatchProtocol'
import { getPresenceRecords } from './collaborationPresenceRuntime'
import { pushNavigation } from '../knowledgeSurfaceRuntime/navigationSurfaceRuntime'
import type { NavigationTarget } from '../knowledgeSurfaceRuntime/types'
import type { DocKey } from '../knowledgeRuntime/types'

let followActorId: string | null = null

export function followRemoteUser(actorId: string | null): void {
  followActorId = actorId
  if (!actorId) return
  const presence = getPresenceRecords().find((p) => p.actorId === actorId)
  if (presence?.activeDocKey) {
    pushNavigation({
      docKey: presence.activeDocKey,
      absolutePath: '',
    })
  }
}

export function getFollowedActorId(): string | null {
  return followActorId
}

export function applyNavigationPatch(payload: {
  docKey: DocKey
  absolutePath?: string
  heading?: string
  actorId: string
}): void {
  if (followActorId && followActorId !== payload.actorId) return
  const entry: NavigationTarget = {
    docKey: payload.docKey,
    absolutePath: payload.absolutePath ?? '',
    heading: payload.heading,
  }
  pushNavigation(entry)
}

export function broadcastNavigationPatch(
  target: NavigationTarget,
): ReturnType<typeof createDistributedPatch> {
  return createDistributedPatch('navigation', target)
}

export function resetCollaborativeNavigationRuntime(): void {
  followActorId = null
}
