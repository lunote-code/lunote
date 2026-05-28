import { scheduleLunaWorkspaceSnapshot, workspaceIdFromRoot } from '../../lunaPersistence'
import { isBufferTabId } from '../runtimePath'
import { subscribeDocumentEvents } from '../documentEventStream'
import { getDocumentRuntimeSnapshot } from '../documentKernel'

export function installPersistenceProjection(): () => void {
  const persistFromKernelSnapshot = (): void => {
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

  return subscribeDocumentEvents((event) => {
    if (event.type === 'WorkspaceRestored' || event.type === 'TabsChanged' || event.type === 'DocumentOpened') {
      persistFromKernelSnapshot()
      return
    }
    if (event.type === 'DocumentContentChanged') {
      const src = event.source ?? ''
      if (
        src.startsWith('tab-') ||
        src === 'external-fs-inactive-reload' ||
        src === 'save-conflict-revert' ||
        src === 'window-close-flush'
      ) {
        persistFromKernelSnapshot()
      }
    }
  })
}
