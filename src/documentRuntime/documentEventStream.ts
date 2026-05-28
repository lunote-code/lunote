import type { DocumentEvent } from './documentTypes'

type Subscriber = (event: DocumentEvent) => void
type SubscriberOptions = {
  replayRecent?: boolean
  filter?: (event: DocumentEvent) => boolean
}

const subscribers = new Set<Subscriber>()
const eventLog: DocumentEvent[] = []
const pendingEvents: DocumentEvent[] = []
const MAX_EVENT_LOG = 500
let flushScheduled = false

function flushPendingEvents(): void {
  flushScheduled = false
  if (pendingEvents.length === 0) return
  const batch = pendingEvents.splice(0, pendingEvents.length)
  for (const event of batch) {
    eventLog.push(event)
    if (eventLog.length > MAX_EVENT_LOG) {
      eventLog.splice(0, eventLog.length - MAX_EVENT_LOG)
    }
    for (const subscriber of subscribers) {
      subscriber(event)
    }
  }
}

export function publishDocumentEvent(event: DocumentEvent): DocumentEvent {
  pendingEvents.push(event)
  if (!flushScheduled) {
    flushScheduled = true
    queueMicrotask(flushPendingEvents)
  }
  return event
}

export function subscribeDocumentEvents(subscriber: Subscriber): () => void {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function subscribeDocumentEventsWithOptions(
  subscriber: Subscriber,
  options?: SubscriberOptions,
): () => void {
  const wrapped: Subscriber = (event) => {
    if (options?.filter && !options.filter(event)) return
    subscriber(event)
  }
  if (options?.replayRecent) {
    for (const event of eventLog) {
      wrapped(event)
    }
  }
  subscribers.add(wrapped)
  return () => subscribers.delete(wrapped)
}

export function subscribeDocumentEventsByType<TType extends DocumentEvent['type']>(
  type: TType,
  subscriber: (event: Extract<DocumentEvent, { type: TType }>) => void,
  options?: Omit<SubscriberOptions, 'filter'>,
): () => void {
  return subscribeDocumentEventsWithOptions(
    (event) => {
      if (event.type !== type) return
      subscriber(event as Extract<DocumentEvent, { type: TType }>)
    },
    options,
  )
}

export function getDocumentEventLog(): readonly DocumentEvent[] {
  return [...eventLog]
}

export function resetDocumentEventStream(): void {
  eventLog.length = 0
  subscribers.clear()
}

export function documentEventTimestamp(): number {
  return Date.now()
}
