import type { LinkIndexState } from '../knowledgeRuntime'
import type { AbsoluteDocPath, DocKey, SearchHit, WikiLinkTarget } from '../knowledgeRuntime/types'

export type VaultFileAdapter = {
  read: (absolutePath: AbsoluteDocPath) => Promise<string>
  write: (absolutePath: AbsoluteDocPath, content: string) => Promise<void>
  create: (absolutePath: AbsoluteDocPath, content?: string) => Promise<void>
  delete: (absolutePath: AbsoluteDocPath) => Promise<void>
  rename: (from: AbsoluteDocPath, to: AbsoluteDocPath) => Promise<void>
  exists?: (absolutePath: AbsoluteDocPath) => Promise<boolean>
}

export type ResolvedWikiLink = {
  rawTarget: WikiLinkTarget
  resolvedDocKey: DocKey | null
  absolutePath: AbsoluteDocPath | null
  displayLabel: string
  exists: boolean
}

export type BacklinkPanelGroup = {
  sourceDocKey: DocKey
  sourceTitle: string
  sourceAbsolutePath: AbsoluteDocPath
  items: Array<{
    raw: string
    snippet: string
    heading?: string
    blockId?: string
    range: { start: number; end: number }
  }>
}

export type BacklinkPanelSnapshot = {
  docKey: DocKey
  linkIndexState: LinkIndexState
  /** false until link graph bootstrap is completed (READY); it is forbidden to treat inbound=[] as "no backlink".*/
  inboundHydrated: boolean
  inbound: BacklinkPanelGroup[]
  outbound: Array<{
    targetDocKey: DocKey
    targetTitle: string
    raw: string
    heading?: string
    blockId?: string
    alias?: string
  }>
  /** Plain-text phrases that match other notes but are not wiki-linked yet. */
  mentions: Array<{
    phrase: string
    suggestedDocKey: DocKey
    suggestedTitle: string
  }>
  revision: number
}

export type NoteGraphNode = {
  id: string
  docKey: DocKey
  label: string
  heading?: string
  status: 'resolved' | 'unresolved'
  navigable: boolean
  x: number
  y: number
}

export type NoteGraphEdge = {
  id: string
  from: string
  to: string
  kind: 'link' | 'embed'
}

export type NoteGraphSnapshot = {
  centerDocKey: DocKey | null
  depth: number
  nodes: NoteGraphNode[]
  edges: NoteGraphEdge[]
  viewport: { x: number; y: number; zoom: number }
  revision: number
}

export type KnowledgeSearchSnapshot = {
  query: string
  hits: SearchHit[]
  loading: boolean
  revision: number
}

export type NavigationEntry = {
  docKey: DocKey
  absolutePath: AbsoluteDocPath
  heading?: string
  blockId?: string
  title: string
}

export type NavigationSnapshot = {
  current: NavigationEntry | null
  canBack: boolean
  canForward: boolean
  stackIndex: number
  stackLength: number
  revision: number
}

export type KnowledgeWorkspaceTabSnapshot = {
  id: string
  docKey: DocKey
  absolutePath: AbsoluteDocPath
  title: string
  pinned: boolean
  active: boolean
}

export type KnowledgeWorkspaceSnapshot = {
  vaultId: string | null
  rootDir: string | null
  tabs: KnowledgeWorkspaceTabSnapshot[]
  activeDocKey: DocKey | null
  revision: number
}

import type { GraphViewportSnapshot } from './graphViewportRuntime'
import type { OSKernelTickState } from './osKernelProjection'
import type { SurfaceLayoutSnapshot } from './surfaceLayoutRuntime'

export type { OSKernelTickState, SurfaceLayoutSnapshot, GraphViewportSnapshot }

/** @deprecated OKFL uses kernelTickState.interaction*/
export type { InteractionTimelineSnapshot } from './ui/interactionModel/interactionTimeAxis'

export type KnowledgeOSSnapshot = {
  /** Unify OSKernelClock tick (= revision).*/
  revision: number
  vaultId: string | null
  rootDir: string | null
  activeDocKey: DocKey | null
  navigation: NavigationSnapshot
  backlinks: BacklinkPanelSnapshot | null
  graph: NoteGraphSnapshot
  search: KnowledgeSearchSnapshot
  workspace: KnowledgeWorkspaceSnapshot
  kernelTickState: OSKernelTickState
  surfaceLayout: SurfaceLayoutSnapshot
}
