/**
 * Startup phase guard: only delays force layout / heavy graph rebuild.
 * Cannot be used to block click, selection, navigation, viewport center.
 */
let knowledgeOSBooting = true

export function isKnowledgeOSBooting(): boolean {
  return knowledgeOSBooting
}

/** Only layout engine paths are used.*/
export function shouldDeferGraphForceLayout(): boolean {
  return knowledgeOSBooting
}

export function beginKnowledgeOSBoot(): void {
  knowledgeOSBooting = true
}

export function endKnowledgeOSBoot(): void {
  knowledgeOSBooting = false
}

export function resetKnowledgeOSBoot(): void {
  knowledgeOSBooting = true
}
