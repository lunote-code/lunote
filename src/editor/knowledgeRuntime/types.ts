/** In-Vault document key: relative path (posix, no extension)*/
export type DocKey = string

export type AbsoluteDocPath = string

export type BlockRefId = string

export type WikiLinkTarget = {
  docKey: DocKey
  heading?: string
  blockId?: BlockRefId
  alias?: string
}

export type CanonicalDocumentTarget = {
  docKey: DocKey
  status: 'resolved' | 'unresolved'
  anchor?: {
    headingSlug?: string
    blockId?: BlockRefId
  }
  raw?: string
  canonical?: string
  label?: string
}

export type WikiLinkKind = 'link' | 'embed'

export type ParsedWikiLink = {
  raw: string
  kind: WikiLinkKind
  target: WikiLinkTarget
  start: number
  end: number
}

export type ParsedBlockRef = {
  blockId: BlockRefId
  start: number
  end: number
  /** 1-based source line number, produced by indexer parser */
  line?: number
}

export type DocumentFrontmatter = {
  title?: string
  tags?: string[]
  aliases?: string[]
  created?: string
  updated?: string
  [key: string]: unknown
}

export type DocumentKnowledgeMeta = {
  docKey: DocKey
  absolutePath: AbsoluteDocPath
  title: string
  frontmatter: DocumentFrontmatter
  links: ParsedWikiLink[]
  embeds: ParsedWikiLink[]
  blockRefs: ParsedBlockRef[]
  outboundTags: string[]
  indexedAt: number
  contentHash: string
  bodySample?: string
}

export type GraphNodeKind = 'page' | 'heading' | 'block' | 'tag' | 'unresolved'

export type GraphNode = {
  id: string
  kind: GraphNodeKind
  status?: 'resolved' | 'unresolved'
  docKey?: DocKey
  label: string
  heading?: string
  blockId?: BlockRefId
  tag?: string
  canonical?: string
  raw?: string
}

export type GraphEdgeKind = 'link' | 'embed' | 'reference' | 'mention'

export type GraphEdge = {
  id: string
  kind: GraphEdgeKind
  from: string
  to: string
  sourceDocKey: DocKey
  targetDocKey?: DocKey
  targetStatus?: 'resolved' | 'unresolved'
}

export type BacklinkEntry = {
  sourceDocKey: DocKey
  sourceAbsolutePath: AbsoluteDocPath
  sourceTitle: string
  links: ParsedWikiLink[]
}

export type VaultSession = {
  vaultId: string
  rootDir: string
  openedAt: number
}

export type SearchHit = {
  docKey: DocKey
  absolutePath: AbsoluteDocPath
  title: string
  score: number
  snippet?: string
  matchKind: 'title' | 'tag' | 'content' | 'backlink'
}
