/**
 * Knowledge OS is plugged into Luna's runtime boundaries.
 * Collaboration / distributed modules live under src/experimental/ and are not initialized in boot.
 */
export const ACTIVE_KNOWLEDGE_OS_MODULES = [
  'vaultRuntime',
  'noteLifecycleRuntime',
  'wikiLinkRuntime',
  'backlinkPanelRuntime',
  'noteGraphRuntime',
  'knowledgeSearchRuntime',
  'noteNavigationRuntime',
  'knowledgeWorkspaceRuntime',
  'knowledgeUIBridge',
  'surfaceLayoutRuntime',
  'surfaceSplitLayoutRuntime',
] as const

export const DEFERRED_KNOWLEDGE_OS_MODULES = [
  'knowledgeCollaborationRuntime',
  'distributedWorkspaceRuntime',
  'distributedGraphRuntime',
  'collaborationSessionRuntime',
] as const

export function isDeferredKnowledgeModule(moduleId: string): boolean {
  return (DEFERRED_KNOWLEDGE_OS_MODULES as readonly string[]).includes(moduleId)
}
