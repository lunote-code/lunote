import type { AbsoluteDocPath, DocKey, DocumentKnowledgeMeta } from './types'

const contentHashByKey = new Map<DocKey, string>()
const pathIndex = new Map<AbsoluteDocPath, DocKey>()

export function hashContent(content: string): string {
  let h = 5381
  for (let i = 0; i < content.length; i++) {
    h = (h * 33) ^ content.charCodeAt(i)
  }
  return `${content.length}:${h >>> 0}`
}

export function getIndexedContentHash(docKey: DocKey): string | undefined {
  return contentHashByKey.get(docKey)
}

export function isDocumentIndexStale(docKey: DocKey, content: string): boolean {
  const prev = contentHashByKey.get(docKey)
  if (!prev) return true
  return prev !== hashContent(content)
}

export function markDocumentIndexed(meta: DocumentKnowledgeMeta): void {
  contentHashByKey.set(meta.docKey, meta.contentHash)
  pathIndex.set(meta.absolutePath, meta.docKey)
}

export function removeFromKnowledgeIndex(docKey: DocKey, absolutePath?: AbsoluteDocPath): void {
  contentHashByKey.delete(docKey)
  if (absolutePath) pathIndex.delete(absolutePath)
}

export function resolveDocKeyByPath(path: AbsoluteDocPath): DocKey | undefined {
  return pathIndex.get(path)
}

export function resetKnowledgeIndex(): void {
  contentHashByKey.clear()
  pathIndex.clear()
}
