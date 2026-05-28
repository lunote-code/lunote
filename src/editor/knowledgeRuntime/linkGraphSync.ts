import { invalidateBacklinkCache } from './backlinkEngine'
import { emitKnowledgeEvent } from './knowledgeEvents'
import {
  getLinkGraphEdgeCounts,
  rebuildIncomingFromOutgoing,
  refreshAllLinkRefsFromRegistry,
} from './linkGraphIndex'
import { rebuildGraphEdgesFromLinkIndex } from './linkGraph'

/** Reparse linkGraphIndex true source and project to linkGraph (called after incremental indexing/bootstrap ends).*/
export function finalizeLinkGraphSync(): void {
  refreshAllLinkRefsFromRegistry()
  rebuildIncomingFromOutgoing()
  rebuildGraphEdgesFromLinkIndex()
  invalidateBacklinkCache()
  const { outgoingEdges } = getLinkGraphEdgeCounts()
  emitKnowledgeEvent('graph-updated', {
    nodeCount: 0,
    edgeCount: outgoingEdges,
  })
}
