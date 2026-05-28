import { emitKnowledgeEvent } from './knowledgeEvents'
import { getKnowledgeRegistryRevision } from './knowledgeRegistry'
import type { DocKey } from './types'

const tagToDocs = new Map<string, Set<DocKey>>()
let indexRevision = -1

function ensureFresh(): void {
  const rev = getKnowledgeRegistryRevision()
  if (indexRevision === rev) return
  indexRevision = rev
}

export function indexTagsForDocument(docKey: DocKey, tags: string[]): void {
  for (const set of tagToDocs.values()) {
    set.delete(docKey)
  }
  for (const tag of tags) {
    const key = tag.toLowerCase()
    if (!tagToDocs.has(key)) tagToDocs.set(key, new Set())
    tagToDocs.get(key)!.add(docKey)
    emitKnowledgeEvent('tag-added', { docKey, tag: key })
  }
}

export function removeDocumentFromTagIndex(docKey: DocKey): void {
  for (const [tag, set] of tagToDocs) {
    if (set.delete(docKey) && set.size === 0) {
      tagToDocs.delete(tag)
      emitKnowledgeEvent('tag-removed', { docKey, tag })
    }
  }
}

export function getDocumentsByTag(tag: string): DocKey[] {
  ensureFresh()
  return [...(tagToDocs.get(tag.toLowerCase()) ?? [])]
}

export function listAllTags(): string[] {
  return [...tagToDocs.keys()].sort()
}

export function resetTagIndex(): void {
  tagToDocs.clear()
  indexRevision = -1
}
