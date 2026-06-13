import type { DocKey } from '../../editor/knowledgeRuntime/types'

export type CollaborationPhase =
  | 'connecting'
  | 'synchronizing'
  | 'active'
  | 'degraded'
  | 'offline'
  | 'recovering'
  | 'destroyed'

export type PresencePhase = 'join' | 'active' | 'idle' | 'background' | 'offline' | 'destroyed'

export type PatchKind =
  | 'block'
  | 'graph'
  | 'workspace'
  | 'overlay'
  | 'navigation'
  | 'awareness'
  | 'cursor'
  | 'selection'
  | 'viewport'

export type DistributedRuntimePatch = {
  patchId: string
  kind: PatchKind
  actorId: string
  sessionId: string
  logicalTime: number
  vectorClock: Record<string, number>
  timestamp: number
  baseEpoch: number
  payload: unknown
}

export type CollaborationSession = {
  sessionId: string
  vaultId: string
  localActorId: string
  phase: CollaborationPhase
  connectedAt: number
}

export type PresenceRecord = {
  actorId: string
  displayName: string
  phase: PresencePhase
  activeDocKey: DocKey | null
  activeBlockId: string | null
  lastSeen: number
  color: string
}

export type RemoteCursor = {
  actorId: string
  docKey: DocKey | null
  blockId: string | null
  start: number
  end: number
  surface: 'pm' | 'textarea' | 'block'
  revision: number
}

export type RemoteViewport = {
  actorId: string
  docKey: DocKey | null
  x: number
  y: number
  zoom: number
  scrollTop: number
}

export type CollaborationSnapshot = {
  revision: number
  epoch: number
  session: CollaborationSession | null
  presence: PresenceRecord[]
  cursors: RemoteCursor[]
  selections: RemoteCursor[]
  viewports: RemoteViewport[]
  workspaceEpoch: number
  graphEpoch: number
  appliedPatchCount: number
}
