import {
  getIncomingLinkRefs,
  normalizeDocKeyForComparison,
} from '../knowledgeRuntime'
import type { LinkRef } from '../knowledgeRuntime/linkGraphIndex'
import type { DocKey } from '../knowledgeRuntime/types'
import type { NoteGraphNode } from './types'

export function sourceLineForBodyOffset(body: string, offset: number): number {
  const safe = Math.max(0, Math.min(offset, body.length))
  let line = 1
  for (let i = 0; i < safe; i += 1) {
    if (body.charCodeAt(i) === 10) line += 1
  }
  return line
}

export function resolveIncomingLinkForGraphUnresolvedNode(
  node: NoteGraphNode,
  preferredSourceDocKey?: DocKey | null,
): LinkRef | null {
  const lookupKeys = new Set<DocKey>()
  lookupKeys.add(node.docKey)
  if (node.docKey.startsWith('unresolved:')) {
    lookupKeys.add(node.docKey.slice('unresolved:'.length))
  }
  lookupKeys.add(normalizeDocKeyForComparison(node.docKey))

  const refs: LinkRef[] = []
  const seen = new Set<string>()
  for (const key of lookupKeys) {
    if (!key) continue
    for (const ref of getIncomingLinkRefs(key)) {
      const id = `${ref.sourceDocKey}|${ref.start}|${ref.end}|${ref.raw}`
      if (seen.has(id)) continue
      seen.add(id)
      refs.push(ref)
    }
  }
  if (refs.length === 0) return null
  if (preferredSourceDocKey) {
    const preferred = refs.find((ref) => ref.sourceDocKey === preferredSourceDocKey)
    if (preferred) return preferred
  }
  return refs[0] ?? null
}

export function resolveUnresolvedGraphNodeNavigation(
  node: NoteGraphNode,
  preferredSourceDocKey?: DocKey | null,
): {
  docKey: DocKey
  heading?: string
  blockId?: string
  linkBodyOffset?: number
} | null {
  if (node.status !== 'unresolved') return null
  const ref = resolveIncomingLinkForGraphUnresolvedNode(node, preferredSourceDocKey)
  if (!ref) return null

  let linkBodyOffset: number | undefined
  if (!ref.heading && !ref.blockId) {
    linkBodyOffset = ref.start
  }

  return {
    docKey: ref.sourceDocKey,
    heading: ref.heading,
    blockId: ref.blockId,
    linkBodyOffset,
  }
}
