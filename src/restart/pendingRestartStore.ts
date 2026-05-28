/** Non-persistent: Setting changes (such as language) marked "need to take effect after restart".*/

export type PendingRestartReason = 'language' | null

type Sub = () => void

let reason: PendingRestartReason = null
const subs = new Set<Sub>()

function notify() {
  for (const s of subs) s()
}

export function getPendingRestartReason(): PendingRestartReason {
  return reason
}

export function setPendingRestartReason(next: PendingRestartReason) {
  reason = next
  notify()
}

export function subscribePendingRestart(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}
