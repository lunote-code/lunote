const BOOT_PERF_ENABLED =
  typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)

export function markBootPhase(phase: string, detail?: Record<string, unknown>): void {
  if (!BOOT_PERF_ENABLED || typeof performance === 'undefined') return
  const markName = `boot:${phase}`
  performance.mark(markName)
  if (detail) {
    console.info(`[BOOT][perf] ${phase}`, detail)
    return
  }
  console.info(`[BOOT][perf] ${phase}`)
}

export function measureBootSince(navigationStartPhase: string, endPhase: string): number | null {
  if (!BOOT_PERF_ENABLED || typeof performance === 'undefined') return null
  const start = `boot:${navigationStartPhase}`
  const end = `boot:${endPhase}`
  try {
    performance.measure(`boot:${navigationStartPhase}->${endPhase}`, start, end)
    const entries = performance.getEntriesByName(`boot:${navigationStartPhase}->${endPhase}`)
    const last = entries.at(-1)
    return last?.duration ?? null
  } catch {
    return null
  }
}
