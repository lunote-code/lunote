import { subscribeDocumentEvents } from '../documentEventStream'
import { persistWorkspaceSnapshotNow } from '../persistWorkspaceSnapshot'
import { flushLunaWorkspaceSnapshotWrites } from '../../lunaPersistence'

export function installPersistenceProjection(): () => void {
  const persistFromKernelSnapshot = (): void => {
    persistWorkspaceSnapshotNow()
  }

  return subscribeDocumentEvents((event) => {
    if (
      event.type === 'WorkspaceRestored' ||
      event.type === 'TabsChanged' ||
      event.type === 'DocumentOpened'
    ) {
      persistFromKernelSnapshot()
      return
    }
    if (event.type === 'DocumentSaved') {
      persistFromKernelSnapshot()
      void flushLunaWorkspaceSnapshotWrites().catch(() => undefined)
      return
    }
    if (event.type === 'DocumentContentChanged') {
      persistFromKernelSnapshot()
    }
  })
}
