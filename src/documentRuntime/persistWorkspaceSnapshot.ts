import {
  scheduleLunaWorkspaceSnapshot,
  type LunaRecoveryDraftSnapshot,
  type LunaWorkspaceSnapshot,
  workspaceIdFromRoot,
} from '../lunaPersistence'
import { listDirtyDocumentPaths } from '../lib/documentDirty'
import { diskMarkdownForDocumentSave } from '../lib/editorContentSync'
import { getTabBody } from './tabBodiesStore'
import { isBufferTabId } from './runtimePath'
import { getDocumentRuntimeSnapshot } from './documentKernel'
import { pathsEqual } from '../lib/workspacePathUtils'

function buildRecoveryDrafts(
  snapshot: ReturnType<typeof getDocumentRuntimeSnapshot>,
): Record<string, LunaRecoveryDraftSnapshot> {
  const drafts: Record<string, LunaRecoveryDraftSnapshot> = {}
  for (const path of listDirtyDocumentPaths()) {
    if (!path || isBufferTabId(path)) continue
    const latestContent =
      getTabBody(path) ??
      (pathsEqual(snapshot.activePath, path) ? snapshot.content : undefined)
    if (latestContent == null) continue
    drafts[path] = {
      // Persist full disk markdown so restore compares cleanly against on-disk files.
      content: diskMarkdownForDocumentSave(path, latestContent),
      updatedAt: Date.now(),
    }
  }
  return drafts
}

export function buildWorkspaceSnapshot(options?: { clearRecoveryDrafts?: boolean }): LunaWorkspaceSnapshot | null {
  const kernel = getDocumentRuntimeSnapshot()
  const root = kernel.rootDir?.trim()
  if (!root) return null
  const recoveryDrafts = options?.clearRecoveryDrafts ? {} : buildRecoveryDrafts(kernel)
  return {
    workspaceId: workspaceIdFromRoot(root),
    rootDir: root,
    activePath: kernel.activePath || null,
    openTabs: kernel.openedTabs.filter((path) => !isBufferTabId(path)),
    recoveryDrafts,
    lastNavigationTarget: kernel.activePath || null,
    updatedAt: Date.now(),
  }
}

/** Immediately write the current kernel active path and tag list to the Luna snapshot (used for Tab switching and other paths that do not trigger TabsChanged)*/
export function persistWorkspaceSnapshotNow(options?: { clearRecoveryDrafts?: boolean }): void {
  const snapshot = buildWorkspaceSnapshot(options)
  if (!snapshot) return
  scheduleLunaWorkspaceSnapshot(snapshot)
}
