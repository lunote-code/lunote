export type VectorClock = Record<string, number>

let localActorId = 'local'
let logicalTime = 0
let reconciliationEpoch = 0
const vectorClock: VectorClock = {}

export function setDistributedClockActor(actorId: string): void {
  localActorId = actorId
  if (!(actorId in vectorClock)) vectorClock[actorId] = 0
}

export function getLocalActorId(): string {
  return localActorId
}

export function tickLogicalClock(): number {
  logicalTime += 1
  vectorClock[localActorId] = (vectorClock[localActorId] ?? 0) + 1
  return logicalTime
}

export function getLogicalTime(): number {
  return logicalTime
}

export function getVectorClock(): Readonly<VectorClock> {
  return { ...vectorClock }
}

export function mergeVectorClock(remote: VectorClock): void {
  for (const [actor, t] of Object.entries(remote)) {
    vectorClock[actor] = Math.max(vectorClock[actor] ?? 0, t)
  }
  vectorClock[localActorId] = (vectorClock[localActorId] ?? 0) + 1
  logicalTime += 1
}

export function compareVectorClocks(a: VectorClock, b: VectorClock): 'before' | 'after' | 'concurrent' {
  let aBeforeB = false
  let bBeforeA = false
  const actors = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const actor of actors) {
    const av = a[actor] ?? 0
    const bv = b[actor] ?? 0
    if (av < bv) aBeforeB = true
    if (bv < av) bBeforeA = true
  }
  if (aBeforeB && !bBeforeA) return 'before'
  if (bBeforeA && !aBeforeB) return 'after'
  return 'concurrent'
}

export function bumpReconciliationEpoch(): number {
  reconciliationEpoch += 1
  return reconciliationEpoch
}

export function getReconciliationEpoch(): number {
  return reconciliationEpoch
}

export function isPatchStale(patchEpoch: number, patchLogicalTime: number): boolean {
  if (patchEpoch < reconciliationEpoch) return true
  return patchLogicalTime < logicalTime - 10_000
}

export function resetDistributedClock(): void {
  localActorId = 'local'
  logicalTime = 0
  reconciliationEpoch = 0
  for (const k of Object.keys(vectorClock)) delete vectorClock[k]
}
