/** Session-only AI model override for the rail panel (not persisted to settings). */

type Sub = () => void

let sessionModelOverride: string | null = null
const subs = new Set<Sub>()

function notify(): void {
  for (const sub of subs) sub()
}

export function getAiSessionModelOverride(): string | null {
  return sessionModelOverride
}

export function setAiSessionModelOverride(model: string | null): void {
  const next = model?.trim() || null
  if (sessionModelOverride === next) return
  sessionModelOverride = next
  notify()
}

export function subscribeAiSessionModelStore(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export function resetAiSessionModelStoreForTests(): void {
  sessionModelOverride = null
  notify()
}
