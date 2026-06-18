/** Returned as BlockRenderOutput.message; mapped to i18n in MermaidView. */
export const MERMAID_ERROR_NOT_DIAGRAM = 'MERMAID_ERROR_NOT_DIAGRAM'

const MERMAID_DIAGRAM_PREFIXES = [
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'statediagram-v2',
  'erdiagram',
  'journey',
  'gantt',
  'pie',
  'gitgraph',
  'mindmap',
  'timeline',
  'quadrantchart',
  'requirementdiagram',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'block-beta',
  'block',
  'kanban',
  'architecture-beta',
  'xychart-beta',
  'sankey-beta',
  'packet-beta',
  'treemap-beta',
] as const

function firstMeaningfulLine(source: string): string {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('%%')) continue
    return trimmed
  }
  return ''
}

/** Heuristic: reject obvious Markdown/plain text before calling mermaid.render. */
export function looksLikeMermaidDiagramSource(source: string): boolean {
  const trimmed = source.trim()
  if (!trimmed) return true

  const first = firstMeaningfulLine(trimmed)
  if (!first) return true

  const normalized = first.replace(/\s+/g, '').toLowerCase()
  if (MERMAID_DIAGRAM_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true
  }

  // Markdown headings / lists / blockquotes are never valid diagram headers.
  if (/^#{1,6}\s/.test(first)) return false
  if (/^[-*+]\s/.test(first)) return false
  if (/^\d+\.\s/.test(first)) return false
  if (/^>\s/.test(first)) return false

  return false
}

export function mermaidRenderErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Mermaid render failed'
}
