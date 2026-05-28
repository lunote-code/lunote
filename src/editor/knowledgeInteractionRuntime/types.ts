import type { DocKey, ParsedWikiLink, WikiLinkTarget } from '../knowledgeRuntime/types'

export type { WikiLinkTarget }

export type InteractionPriority = 'critical' | 'visible' | 'background' | 'idle'

export type HeuristicSuggestion = {
  authority: 'suggestion'
}

export type PreviewTarget = WikiLinkTarget & {
  resolvedDocKey: DocKey | null
}

export type PreviewFragment = {
  docKey: DocKey
  title: string
  heading?: string
  blockId?: string
  markdown: string
  plainSnippet: string
  contentHash: string
  cachedAt: number
}

export type BacklinkSurfaceItem = {
  sourceDocKey: DocKey
  sourceTitle: string
  sourceAbsolutePath: string
  links: ParsedWikiLink[]
  snippet: string
  paragraphPreview: string
  mentionOffset: number
  score: number
  group: 'direct' | 'embed' | 'mention'
}

export type BacklinkSurfaceGroup = {
  id: string
  label: string
  items: BacklinkSurfaceItem[]
}

export type ContextGraphNode = {
  id: string
  docKey: DocKey
  label: string
  role: 'current' | 'backlink' | 'forward' | 'tag' | 'reference'
  x: number
  y: number
}

export type ContextGraphEdge = {
  id: string
  from: string
  to: string
  kind: 'link' | 'backlink' | 'tag' | 'shared'
}

export type SemanticSearchResult = HeuristicSuggestion & {
  docKey: DocKey
  absolutePath: string
  title: string
  score: number
  snippet: string
  matchedHeading?: string
  matchedBlock?: string
  relevance: {
    fuzzy: number
    alias: number
    backlink: number
    tag: number
    recency: number
    graphDistance: number
  }
}

export type UnlinkedMentionCandidate = HeuristicSuggestion & {
  phrase: string
  suggestedDocKey: DocKey
  suggestedTitle: string
  confidence: number
  start: number
  end: number
}

export type KnowledgeSuggestion = HeuristicSuggestion & {
  docKey: DocKey
  title: string
  reason: 'related' | 'link' | 'tag' | 'graph' | 'semantic'
  score: number
}

export type PeekRequest = {
  kind: 'definition' | 'reference' | 'backlink'
  target: WikiLinkTarget
  sourceDocKey?: DocKey
}

export type SurfaceKind = 'hover-card' | 'backlinks-panel' | 'search-preview' | 'graph-popup' | 'suggestion-widget'

export type ContextSurfaceState = {
  id: string
  kind: SurfaceKind
  docKey?: DocKey
  visible: boolean
  hydrated: boolean
  revision: number
}
