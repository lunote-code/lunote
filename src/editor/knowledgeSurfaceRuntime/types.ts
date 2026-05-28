import type { DocKey, WikiLinkTarget } from '../knowledgeRuntime/types'

export type SurfaceKind =
  | 'hover-card'
  | 'peek-inline'
  | 'peek-overlay'
  | 'backlinks-panel'
  | 'graph-panel'
  | 'search-panel'
  | 'command-palette'
  | 'sidebar'
  | 'overlay'

export type SurfaceLifecyclePhase =
  | 'mount'
  | 'visible'
  | 'background'
  | 'virtualized'
  | 'suspended'
  | 'destroyed'

export type DockRegion = 'left' | 'right' | 'bottom' | 'floating'

export type SurfacePriority = 'critical' | 'interaction' | 'background' | 'idle'

export type HoverPhase = 'hover-start' | 'hover-pending' | 'hover-visible' | 'hover-hidden' | 'hover-destroyed'

export type SurfaceSnapshot = {
  id: string
  kind: SurfaceKind
  phase: SurfaceLifecyclePhase
  dockRegion: DockRegion | null
  pinned: boolean
  detached: boolean
  docKey: DocKey | null
  revision: number
  zIndex: number
}

export type HoverSurfaceSnapshot = SurfaceSnapshot & {
  hoverPhase: HoverPhase
  target: WikiLinkTarget | null
  anchor: { x: number; y: number } | null
  previewReady: boolean
}

export type DockSurfaceRegistration = {
  id: string
  kind: SurfaceKind
  defaultRegion: DockRegion
  pinned?: boolean
}

export type WorkspaceLayoutSnapshot = {
  version: 1
  docks: Record<DockRegion, string[]>
  floating: string[]
  splitTree: SplitNode | null
  activeSurfaceId: string | null
  graphViewport: { x: number; y: number; zoom: number }
}

export type SplitNode =
  | { type: 'leaf'; surfaceId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; ratio: number; a: SplitNode; b: SplitNode }

export type NavigationTarget = {
  docKey: DocKey
  absolutePath: string
  heading?: string
  blockId?: string
}

export type CommandPaletteItem = {
  id: string
  label: string
  category: 'command' | 'doc' | 'heading' | 'tag' | 'backlink' | 'action'
  score: number
  docKey?: DocKey
  payload?: unknown
}
