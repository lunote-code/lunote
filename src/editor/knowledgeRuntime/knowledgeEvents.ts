export type KnowledgeEventKind =
  | 'document-added'
  | 'document-removed'
  | 'document-renamed'
  | 'link-added'
  | 'link-removed'
  | 'tag-added'
  | 'tag-removed'
  | 'index-updated'
  | 'graph-updated'
  | 'vault-opened'
  | 'vault-closed'

export type KnowledgeEventPayload = {
  'document-added': { docKey: string; absolutePath: string }
  'document-removed': { docKey: string; absolutePath: string }
  'document-renamed': { fromKey: string; toKey: string; fromPath: string; toPath: string }
  'link-added': { sourceDocKey: string; targetDocKey: string; kind: string }
  'link-removed': { sourceDocKey: string; targetDocKey: string; kind: string }
  'tag-added': { docKey: string; tag: string }
  'tag-removed': { docKey: string; tag: string }
  'index-updated': { docKey: string; revision: number }
  'graph-updated': { nodeCount: number; edgeCount: number }
  'vault-opened': { vaultId: string; rootDir: string }
  'vault-closed': { vaultId: string }
}

export type KnowledgeEvent<K extends KnowledgeEventKind = KnowledgeEventKind> = {
  kind: K
  timestamp: number
  payload: KnowledgeEventPayload[K]
}

type Listener = (event: KnowledgeEvent) => void

const listeners = new Set<Listener>()
let revision = 0

export function getKnowledgeEventRevision(): number {
  return revision
}

export function emitKnowledgeEvent<K extends KnowledgeEventKind>(
  kind: K,
  payload: KnowledgeEventPayload[K],
): void {
  revision += 1
  const event: KnowledgeEvent<K> = {
    kind,
    timestamp: performance.now(),
    payload,
  }
  listeners.forEach((fn) => {
    try {
      fn(event as KnowledgeEvent)
    } catch {
      /* observer */
    }
  })
}

export function subscribeKnowledgeEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetKnowledgeEvents(): void {
  listeners.clear()
  revision = 0
}
