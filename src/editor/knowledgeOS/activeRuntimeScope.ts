/**
 * Knowledge OS is plugged into Luna's runtime boundaries.
 * Directories such as collaboration / distributed are reserved modules and are not initialized in the boot path.
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
