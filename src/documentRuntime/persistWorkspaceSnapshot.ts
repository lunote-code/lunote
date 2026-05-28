import { scheduleLunaWorkspaceSnapshot, workspaceIdFromRoot } from '../lunaPersistence'
import { isBufferTabId } from './runtimePath'
import { getDocumentRuntimeSnapshot } from './documentKernel'

/** Immediately write the current kernel active path and tag list to the Luna snapshot (used for Tab switching and other paths that do not trigger TabsChanged)*/
export function persistWorkspaceSnapshotNow(): void {
  const kernel = getDocumentRuntimeSnapshot()
  const root = kernel.rootDir?.trim()
  if (!root) return
  scheduleLunaWorkspaceSnapshot({
    workspaceId: workspaceIdFromRoot(root),
    rootDir: root,
    activePath: kernel.activePath || null,
    openTabs: kernel.openedTabs.filter((path) => !isBufferTabId(path)),
    lastNavigationTarget: kernel.activePath || null,
    updatedAt: Date.now(),
  })
}
