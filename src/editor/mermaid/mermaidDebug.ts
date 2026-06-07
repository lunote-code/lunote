function formatMermaidDebugValue(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map((item) => formatMermaidDebugValue(item)).join(',')}]`
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function debugMermaid(label: string, payload?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  if (!payload || Object.keys(payload).length === 0) {
    console.log(`[MERMAID] ${label}`)
    return
  }
  const details = Object.entries(payload)
    .map(([key, value]) => `${key}=${formatMermaidDebugValue(value)}`)
    .join(' ')
  console.log(`[MERMAID] ${label} ${details}`)
}
