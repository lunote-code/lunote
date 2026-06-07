type Listener = (activeId: string | null) => void

let activeHintPopoverId: string | null = null
const listeners = new Set<Listener>()

export function subscribeHintPopover(listener: Listener): () => void {
  listeners.add(listener)
  listener(activeHintPopoverId)
  return () => listeners.delete(listener)
}

export function getActiveHintPopoverId(): string | null {
  return activeHintPopoverId
}

export function setActiveHintPopoverId(id: string | null): void {
  if (activeHintPopoverId === id) return
  activeHintPopoverId = id
  listeners.forEach((listener) => listener(activeHintPopoverId))
}
