import type { Dispatch, SetStateAction } from 'react'

import { teardownKnowledgeOS } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { lockWorkspace } from '../../platform/tauri/workspaceEncryptionService'
import { setWorkspaceImageEncryptionEnabled } from '../../workspace/workspaceImageEncryptionRuntime'
import { forbidWorkspaceAssetScope } from '../../platform/tauri/assetService'
import { evictWorkspaceAssetIndexCache } from '../../assets/workspaceAssetStore'
import { awaitPendingSerialTasks } from '../../lib/saveQueue'
import { awaitTabMutationQueue } from '../../lib/tabOperationQueue'
import { cancelBackgroundWorkspaceIndexing } from './workspaceIndexCoordinator'
import { clearWorkspaceClientMemory, type ClearWorkspaceClientMemoryOptions } from './clearWorkspaceClientMemory'

export type FinalizeLeavingWorkspaceOptions = ClearWorkspaceClientMemoryOptions & {
  setExternalDiskChangedPaths?: Dispatch<SetStateAction<Set<string>>>
}

export type FinalizeLeavingWorkspaceDeps = {
  awaitTabMutationQueue: () => Promise<void>
  awaitPendingSerialTasks: () => Promise<void>
  cancelBackgroundWorkspaceIndexing: () => void
  teardownKnowledgeOS: (rootDir: string) => void
  clearWorkspaceClientMemory: (options: ClearWorkspaceClientMemoryOptions) => void
  evictWorkspaceAssetIndexCache: (rootDir: string) => void
  forbidWorkspaceAssetScope: (rootDir: string) => Promise<void>
  lockWorkspace: (rootDir: string) => Promise<void>
}

const defaultDeps: FinalizeLeavingWorkspaceDeps = {
  awaitTabMutationQueue,
  awaitPendingSerialTasks,
  cancelBackgroundWorkspaceIndexing,
  teardownKnowledgeOS,
  clearWorkspaceClientMemory,
  evictWorkspaceAssetIndexCache,
  forbidWorkspaceAssetScope,
  lockWorkspace,
}

/** Tear down a workspace the user is leaving (switch/close). Call after the next workspace unlock succeeds. */
export async function finalizeLeavingWorkspaceWithDeps(
  previousRoot: string,
  options: FinalizeLeavingWorkspaceOptions = {},
  deps: FinalizeLeavingWorkspaceDeps = defaultDeps,
): Promise<void> {
  const trimmed = previousRoot.trim()
  if (!trimmed) return

  const { setExternalDiskChangedPaths, ...memoryOptions } = options
  await deps.awaitTabMutationQueue()
  await deps.awaitPendingSerialTasks()
  deps.cancelBackgroundWorkspaceIndexing()
  deps.teardownKnowledgeOS(trimmed)
  deps.clearWorkspaceClientMemory({ previousRoot: trimmed, ...memoryOptions })
  deps.evictWorkspaceAssetIndexCache(trimmed)
  await deps.forbidWorkspaceAssetScope(trimmed)
  setExternalDiskChangedPaths?.(new Set())
  await deps.lockWorkspace(trimmed).catch(() => undefined)
  setWorkspaceImageEncryptionEnabled(false)
}

export async function finalizeLeavingWorkspace(
  previousRoot: string,
  options: FinalizeLeavingWorkspaceOptions = {},
): Promise<void> {
  return finalizeLeavingWorkspaceWithDeps(previousRoot, options, defaultDeps)
}
