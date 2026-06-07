const ENDPOINT = '/__luna/debug-log'
const FLUSH_MS = 50
const RETRY_MS = 200

type PendingBatch = {
  channel: string
  entries: unknown[]
  timer: ReturnType<typeof setTimeout> | null
}

const batches = new Map<string, PendingBatch>()

function isDevRuntime(): boolean {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
}

export function isLunaDebugFileSinkAvailable(): boolean {
  return isDevRuntime() && typeof fetch === 'function'
}

export function getLunaDebugFileRelPath(channel: string): string {
  return `~/.luna/logs/${channel}.jsonl`
}

export function sinkLunaDebugEvent(channel: string, entry: unknown, opts?: { urgent?: boolean }): void {
  if (!isLunaDebugFileSinkAvailable()) return

  let batch = batches.get(channel)
  if (!batch) {
    batch = { channel, entries: [], timer: null }
    batches.set(channel, batch)
  }
  batch.entries.push(entry)
  if (opts?.urgent) {
    void flushLunaDebugBatch(channel)
    return
  }
  if (batch.timer != null) return

  batch.timer = setTimeout(() => {
    void flushLunaDebugBatch(channel)
  }, FLUSH_MS)
}

export async function flushLunaDebugFileSink(channel?: string): Promise<void> {
  if (!isLunaDebugFileSinkAvailable()) return
  const channels = channel ? [channel] : [...batches.keys()]
  await Promise.all(channels.map((name) => flushLunaDebugBatch(name)))
}

async function flushLunaDebugBatch(channel: string): Promise<void> {
  const batch = batches.get(channel)
  if (!batch) return
  if (batch.timer != null) {
    clearTimeout(batch.timer)
    batch.timer = null
  }
  if (batch.entries.length === 0) return

  const entries = batch.entries.splice(0, batch.entries.length)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, entries }),
      keepalive: true,
    })
    if (!res.ok) throw new Error(`debug-log ${res.status}`)
  } catch {
    batch.entries.unshift(...entries)
    if (batch.timer == null) {
      batch.timer = setTimeout(() => {
        void flushLunaDebugBatch(channel)
      }, RETRY_MS)
    }
  }
}

export async function clearLunaDebugFile(channel: string): Promise<boolean> {
  if (!isLunaDebugFileSinkAvailable()) return false
  batches.delete(channel)
  try {
    const res = await fetch(`${ENDPOINT}?channel=${encodeURIComponent(channel)}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const channel of batches.keys()) {
      void flushLunaDebugBatch(channel)
    }
  })
}
