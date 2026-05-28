export type InteractionEventKind =
  | 'hover-start'
  | 'hover-end'
  | 'peek-opened'
  | 'peek-closed'
  | 'backlink-selected'
  | 'suggestion-accepted'
  | 'search-ranked'
  | 'context-updated'
  | 'preview-ready'
  | 'surface-hydrated'

export type InteractionEventPayload = {
  'hover-start': { targetId: string; docKey: string | null }
  'hover-end': { targetId: string }
  'peek-opened': { peekId: string; docKey: string }
  'peek-closed': { peekId: string }
  'backlink-selected': { sourceDocKey: string; targetDocKey: string }
  'suggestion-accepted': { docKey: string; reason: string }
  'search-ranked': { query: string; count: number }
  'context-updated': { docKey: string; revision: number }
  'preview-ready': { cacheKey: string; docKey: string }
  'surface-hydrated': { surfaceId: string; kind: string }
}

export type InteractionEvent<K extends InteractionEventKind = InteractionEventKind> = {
  kind: K
  timestamp: number
  payload: InteractionEventPayload[K]
}

type Listener = (event: InteractionEvent) => void

const listeners = new Set<Listener>()
let revision = 0

export function getInteractionEventRevision(): number {
  return revision
}

export function emitInteractionEvent<K extends InteractionEventKind>(
  kind: K,
  payload: InteractionEventPayload[K],
): void {
  revision += 1
  const event: InteractionEvent<K> = {
    kind,
    timestamp: performance.now(),
    payload,
  }
  listeners.forEach((fn) => {
    try {
      fn(event as InteractionEvent)
    } catch {
      /* observer */
    }
  })
}

export function subscribeInteractionEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetInteractionEvents(): void {
  listeners.clear()
  revision = 0
}
