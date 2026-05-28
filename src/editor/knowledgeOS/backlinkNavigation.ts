import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import {
  backlinkIdForDoc,
  backlinkIdForInbound,
  backlinkIdForOutbound,
  resolveBacklinkTarget,
} from './graphIndex'
import { requestNodeActivation } from './graphNodeActivationRuntime'
import { setPendingGraphCenter } from './graphNavigationRuntime'
import { asMetadataResolvedTarget, dispatchKnowledgeNavigate } from './ui/interactionTransaction'
import { resolveWikiTarget } from './wikiLinkRuntime'

export { backlinkIdForDoc, backlinkIdForInbound, backlinkIdForOutbound }

/**
 * Backlink: resolve → navigate → ensure subgraph → wait ready → commit activation + camera.
 */
export function onBacklinkClick(
  backlinkId: string,
  fallbackTarget: WikiLinkTarget,
): boolean {
  const resolved = resolveBacklinkTarget(backlinkId)
  const docKey = resolved?.docKey ?? fallbackTarget.docKey
  if (!docKey) return false

  const wikiResolved = resolveWikiTarget({
    docKey,
    heading: fallbackTarget.heading,
    blockId: fallbackTarget.blockId,
    alias: fallbackTarget.alias,
  })
  if (!wikiResolved.resolvedDocKey) {
    if (import.meta.env.DEV) {
      console.warn('[Backlink] navigate skipped: unresolved wiki target', {
        backlinkId,
        docKey,
        fallbackTarget,
      })
    }
    return false
  }

  const target: WikiLinkTarget = wikiResolved.rawTarget
  const nodeId =
    resolved?.nodeId ??
    (wikiResolved.resolvedDocKey ? `page:${wikiResolved.resolvedDocKey}` : null)

  const navigated = dispatchKnowledgeNavigate('backlink', asMetadataResolvedTarget(target, 'metadata'))

  if (nodeId && wikiResolved.resolvedDocKey) {
    requestNodeActivation(nodeId)
    setPendingGraphCenter(wikiResolved.resolvedDocKey, nodeId)
  }

  return navigated
}
