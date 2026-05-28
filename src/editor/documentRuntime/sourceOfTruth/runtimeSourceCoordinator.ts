import type { RuntimeSnapshot } from '../../codeBlockRuntime/kernel/runtimeSnapshot'
import { createRuntimeSnapshot } from '../../codeBlockRuntime/kernel/runtimeSnapshot'
import { bumpDocumentTick } from '../documentClock'

let canonicalEpoch = 0
let canonical: RuntimeSnapshot | null = null

const listeners = new Set<(snap: RuntimeSnapshot, epoch: number) => void>()

export function getCanonicalEpoch(): number {
  return canonicalEpoch
}

export function getCanonicalSnapshot(): RuntimeSnapshot {
  if (!canonical) {
    canonical = createRuntimeSnapshot()
    canonicalEpoch = canonical.version
  }
  return canonical
}

export function publishCanonicalSnapshot(snapshot?: RuntimeSnapshot): RuntimeSnapshot {
  const next = snapshot ?? createRuntimeSnapshot()
  canonical = next
  canonicalEpoch = next.version
  bumpDocumentTick('history')
  listeners.forEach((fn) => fn(next, canonicalEpoch))
  return next
}

export function subscribeCanonicalSnapshot(
  listener: (snap: RuntimeSnapshot, epoch: number) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetCanonicalCoordinator(): void {
  canonical = null
  canonicalEpoch = 0
  listeners.clear()
}
