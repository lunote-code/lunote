import {
  extractAssetIdsFromMarkdown,
  syncAssetGraphStatsToIndex,
  updateDocumentAssetReferences,
} from '../../assets/assetGraph'
import {
  scheduleReferenceUpdate,
  updateReferences,
} from '../../assets/assetReferenceTracker'
import { isBufferTabId } from '../runtimePath'
import { subscribeDocumentEvents } from '../documentEventStream'

export function installAssetProjection(): () => void {
  return subscribeDocumentEvents((event) => {
    if (event.type === 'DocumentContentChanged') {
      if (!isBufferTabId(event.path)) scheduleReferenceUpdate(event.path, event.content)
      return
    }
    if (event.type === 'DocumentSaved') {
      if (!isBufferTabId(event.path)) updateReferences(event.path, event.content)
      return
    }
    if (event.type === 'AssetImported') {
      const refs = new Set([
        ...extractAssetIdsFromMarkdown(event.content),
        ...event.assetIds,
      ])
      updateDocumentAssetReferences(event.documentPath, [...refs])
      void syncAssetGraphStatsToIndex(event.workspaceId).catch((error) => {
        console.error('[ASSET GRAPH] import sync failed', error)
      })
    }
  })
}
