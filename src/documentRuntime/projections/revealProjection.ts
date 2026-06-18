import { absolutePathToDocKeyOs } from '../../editor/knowledgeOS/vaultRuntime'
import { getKnowledgeInteractionHost } from '../../editor/knowledgeOS/ui/knowledgeInteractionHost'
import type { InteractionIntentSource } from '../../editor/knowledgeOS/ui/interactionModel/types'
import { subscribeDocumentEvents } from '../documentEventStream'

function toInteractionSource(source: string | undefined): InteractionIntentSource {
  if (source === 'navigation:backlink') return 'backlink'
  if (source === 'navigation:graph') return 'graph'
  if (source === 'navigation:wiki') return 'wiki'
  if (source === 'navigation:editor') return 'editor'
  if (source === 'navigation:search') return 'search'
  return 'wiki'
}

export function installRevealProjection(): () => void {
  return subscribeDocumentEvents((event) => {
    if (event.type !== 'DocumentRevealRequested') return
    const host = getKnowledgeInteractionHost()
    const revealNavigationAnchor = host?.revealNavigationAnchor
    if (!revealNavigationAnchor) return
    void Promise.resolve(revealNavigationAnchor({
      docKey: event.docKey ?? absolutePathToDocKeyOs(event.path, event.root),
      absolutePath: event.path,
      heading: event.heading,
      blockId: event.blockId,
      source: toInteractionSource(event.source),
      markdown: event.content,
    })).catch(() => {
      // Navigation anchor failures are surfaced by the host; ignore here.
    })
  })
}
