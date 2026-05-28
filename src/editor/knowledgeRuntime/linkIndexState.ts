export type LinkIndexState = 'UNINITIALIZED' | 'BOOTSTRAPPING' | 'READY' | 'UPDATING'

let linkIndexState: LinkIndexState = 'UNINITIALIZED'
const stateListeners = new Set<() => void>()

export function getLinkIndexState(): LinkIndexState {
  return linkIndexState
}

export function setLinkIndexState(next: LinkIndexState): void {
  if (linkIndexState === next) return
  linkIndexState = next
  if (import.meta.env.DEV && next === 'READY') {
    console.debug('[LinkGraphState]', 'READY')
  }
  stateListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* observer */
    }
  })
}

export function subscribeLinkIndexState(listener: () => void): () => void {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

export function resetLinkIndexState(): void {
  setLinkIndexState('UNINITIALIZED')
}

export function markLinkIndexUpdating(): void {
  if (linkIndexState === 'READY') setLinkIndexState('UPDATING')
}

export function markLinkIndexReadyIfUpdating(): void {
  if (linkIndexState === 'UPDATING') setLinkIndexState('READY')
}
