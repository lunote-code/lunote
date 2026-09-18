import type { NoteGraphNode } from './types'

/** Substring + ordered-character fuzzy score (aligned with workspace search). */
export function fuzzyTextScore(text: string, query: string): number {
  const normalized = text.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return 0
  if (normalized === q) return 100
  if (normalized.startsWith(q)) return 80
  if (normalized.includes(q)) return 50
  let qi = 0
  for (let i = 0; i < normalized.length && qi < q.length; i++) {
    if (normalized[i] === q[qi]) qi++
  }
  return qi === q.length ? 30 : 0
}

export function scoreGraphNodeSearch(node: NoteGraphNode, query: string): number {
  const q = query.trim()
  if (!q) return 0
  const docStem = node.docKey.split('/').pop() ?? node.docKey
  const headingScore = node.heading ? fuzzyTextScore(node.heading, q) : 0
  return Math.max(
    fuzzyTextScore(node.label, q),
    fuzzyTextScore(node.docKey, q),
    fuzzyTextScore(docStem, q),
    headingScore,
  )
}

export function filterGraphNodeSearchMatches(
  nodes: readonly NoteGraphNode[],
  query: string,
): NoteGraphNode[] {
  const normalized = query.trim()
  if (!normalized) return []
  return nodes
    .map((node) => ({ node, score: scoreGraphNodeSearch(node, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.node.label.localeCompare(b.node.label, undefined, { sensitivity: 'base' })
    })
    .map((entry) => entry.node)
}
