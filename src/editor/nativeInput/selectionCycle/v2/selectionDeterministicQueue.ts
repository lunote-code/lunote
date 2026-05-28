type QueuedJob = {
  generation: number
  run: () => void
}

const queues = new WeakMap<HTMLTextAreaElement, QueuedJob[]>()
const flushScheduled = new WeakSet<HTMLTextAreaElement>()

export function enqueueDeterministicJob(
  el: HTMLTextAreaElement,
  generation: number,
  run: () => void,
): void {
  const q = queues.get(el) ?? []
  q.push({ generation, run })
  queues.set(el, q)
  scheduleQueueFlush(el)
}

export function flushDeterministicQueue(
  el: HTMLTextAreaElement,
  isGenerationCurrent: (generation: number) => boolean,
): void {
  flushScheduled.delete(el)
  const q = queues.get(el)
  if (!q?.length) return
  queues.set(el, [])
  for (const job of q) {
    if (!isGenerationCurrent(job.generation)) continue
    job.run()
  }
}

function scheduleQueueFlush(el: HTMLTextAreaElement): void {
  if (flushScheduled.has(el)) return
  flushScheduled.add(el)
  queueMicrotask(() => {
    flushScheduled.delete(el)
    const q = queues.get(el)
    if (!q?.length) return
    const batch = [...q]
    queues.set(el, [])
    for (const job of batch) job.run()
  })
}

export function clearDeterministicQueue(el: HTMLTextAreaElement): void {
  queues.delete(el)
  flushScheduled.delete(el)
}
