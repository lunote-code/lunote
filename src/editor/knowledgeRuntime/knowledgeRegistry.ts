import { canonicalizeWikiLinkText } from './wikiCanonical'
import type {
  AbsoluteDocPath,
  DocKey,
  DocumentKnowledgeMeta,
  VaultSession,
} from './types'

type RegistryState = {
  vault: VaultSession | null
  documents: Map<DocKey, DocumentKnowledgeMeta>
  pathToKey: Map<AbsoluteDocPath, DocKey>
  aliasToKeys: Map<string, Set<DocKey>>
  revision: number
}

const state: RegistryState = {
  vault: null,
  documents: new Map(),
  pathToKey: new Map(),
  aliasToKeys: new Map(),
  revision: 0,
}

export function getKnowledgeRegistryRevision(): number {
  return state.revision
}

export function getActiveVault(): VaultSession | null {
  return state.vault
}

export function setActiveVault(vault: VaultSession | null): void {
  state.vault = vault
  if (!vault) {
    state.documents.clear()
    state.pathToKey.clear()
    state.aliasToKeys.clear()
    state.revision += 1
  }
}

function bumpRevision(): void {
  state.revision += 1
}

export function registerDocumentMeta(meta: DocumentKnowledgeMeta): void {
  const prev = state.documents.get(meta.docKey)
  if (prev) {
    state.pathToKey.delete(prev.absolutePath)
    unregisterAliasesForMeta(prev)
  }
  state.documents.set(meta.docKey, meta)
  state.pathToKey.set(meta.absolutePath, meta.docKey)
  registerAliasesForMeta(meta)
  bumpRevision()
}

export function unregisterDocument(docKey: DocKey): void {
  const meta = state.documents.get(docKey)
  if (!meta) return
  state.documents.delete(docKey)
  state.pathToKey.delete(meta.absolutePath)
  unregisterAliasesForMeta(meta)
  bumpRevision()
}

function aliasKeysFromMeta(meta: DocumentKnowledgeMeta): string[] {
  const keys = new Set<string>()
  keys.add(canonicalizeWikiLinkText(meta.title))
  keys.add(canonicalizeWikiLinkText(meta.docKey))
  const base = meta.docKey.split('/').pop()
  if (base) keys.add(canonicalizeWikiLinkText(base))
  for (const a of meta.frontmatter.aliases ?? []) {
    if (typeof a === 'string' && a.trim()) keys.add(canonicalizeWikiLinkText(a))
  }
  return [...keys].filter(Boolean)
}

function registerAliasesForMeta(meta: DocumentKnowledgeMeta): void {
  for (const key of aliasKeysFromMeta(meta)) {
    const docs = state.aliasToKeys.get(key) ?? new Set<DocKey>()
    docs.add(meta.docKey)
    state.aliasToKeys.set(key, docs)
  }
}

function unregisterAliasesForMeta(meta: DocumentKnowledgeMeta): void {
  for (const key of aliasKeysFromMeta(meta)) {
    const docs = state.aliasToKeys.get(key)
    if (!docs) continue
    docs.delete(meta.docKey)
    if (docs.size === 0) state.aliasToKeys.delete(key)
  }
}

function pickResolvedDocKey(candidates: Set<DocKey>, canonicalQuery: string): DocKey | null {
  if (candidates.size === 0) return null
  if (candidates.size === 1) return [...candidates][0] ?? null
  const sorted = [...candidates].sort((a, b) => a.localeCompare(b))
  const exact = sorted.find((key) => canonicalizeWikiLinkText(key) === canonicalQuery)
  if (exact) return exact
  const base = sorted.find((key) => canonicalizeWikiLinkText(key.split('/').pop() ?? '') === canonicalQuery)
  if (base) return base
  return sorted[0] ?? null
}

export function getDocumentMeta(docKey: DocKey): DocumentKnowledgeMeta | undefined {
  return state.documents.get(docKey)
}

export function getDocumentMetaByPath(path: AbsoluteDocPath): DocumentKnowledgeMeta | undefined {
  const key = state.pathToKey.get(path)
  return key ? state.documents.get(key) : undefined
}

export function resolveDocKey(query: string): DocKey | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  if (state.documents.has(trimmed)) return trimmed

  const canonical = canonicalizeWikiLinkText(trimmed)
  if (canonical && state.documents.has(canonical)) return canonical

  const byAlias = pickResolvedDocKey(
    state.aliasToKeys.get(canonical) ?? state.aliasToKeys.get(trimmed) ?? new Set<DocKey>(),
    canonical,
  )
  if (byAlias) return byAlias

  for (const key of state.documents.keys()) {
    if (canonicalizeWikiLinkText(key) === canonical) return key
    const base = key.split('/').pop()
    if (base && canonicalizeWikiLinkText(base) === canonical) return key
  }
  return null
}

export function listDocumentKeys(): DocKey[] {
  return [...state.documents.keys()]
}

export function listDocumentMetas(): DocumentKnowledgeMeta[] {
  return [...state.documents.values()]
}

export function resetKnowledgeRegistry(): void {
  state.vault = null
  state.documents.clear()
  state.pathToKey.clear()
  state.aliasToKeys.clear()
  state.revision = 0
}
