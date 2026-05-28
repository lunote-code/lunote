import { dispatchDocumentCommand, getDocumentRuntimeSnapshot } from './documentKernel'
import {
  subscribeDocumentEventsByType,
  subscribeDocumentEventsWithOptions,
} from './documentEventStream'
import type { DocumentCommand, DocumentEvent } from './documentTypes'

export type AgentReadableDocumentSnapshot = ReturnType<typeof getDocumentRuntimeSnapshot>

export function readAgentDocumentSnapshot(): AgentReadableDocumentSnapshot {
  return getDocumentRuntimeSnapshot()
}

export async function dispatchAgentDocumentCommand(command: DocumentCommand): Promise<string | void> {
  return dispatchDocumentCommand(command)
}

export function subscribeAgentDocumentEvents(
  subscriber: (event: DocumentEvent) => void,
  options?: { replayRecent?: boolean },
): () => void {
  return subscribeDocumentEventsWithOptions(subscriber, {
    replayRecent: options?.replayRecent ?? false,
  })
}

export function subscribeAgentDocumentSaves(
  subscriber: (event: Extract<DocumentEvent, { type: 'DocumentSaved' }>) => void,
  options?: { replayRecent?: boolean },
): () => void {
  return subscribeDocumentEventsByType('DocumentSaved', subscriber, options)
}
