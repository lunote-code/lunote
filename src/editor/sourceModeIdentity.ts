import type { DocKey } from './knowledgeRuntime/types'

/**
 * Source Mode true value: only written by source code editor/read disk; ⌘/ switch must not be overridden with PM serialization.
 */
const identityByDocKey = new Map<DocKey, string>()

export function setSourceModeIdentity(docKey: DocKey, markdown: string): void {
  identityByDocKey.set(docKey, markdown)
}

export function getSourceModeIdentity(docKey: DocKey): string | undefined {
  return identityByDocKey.get(docKey)
}

export function clearSourceModeIdentity(docKey?: DocKey): void {
  if (docKey) identityByDocKey.delete(docKey)
  else identityByDocKey.clear()
}
