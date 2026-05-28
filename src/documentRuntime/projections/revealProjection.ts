import { absolutePathToDocKeyOs } from '../../editor/knowledgeOS/vaultRuntime'
import { getKnowledgeInteractionHost } from '../../editor/knowledgeOS/ui/knowledgeInteractionHost'
import type { InteractionIntentSource } from '../../editor/knowledgeOS/ui/interactionModel/types'
import { subscribeDocumentEvents } from '../documentEventStream'
import { getDocumentRuntimeSnapshot } from '../documentKernel'

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
    const revealHostExists = Boolean(revealNavigationAnchor)
    const activePath = getDocumentRuntimeSnapshot().activePath
    const activeDocument = activePath
    if (!revealNavigationAnchor) {
      // #region agent log
      console.debug('[document-reveal-effect]', { traceId: event.traceId ?? null, path: event.path, heading: event.heading ?? null, blockId: event.blockId ?? null, hostExists: revealHostExists, activeDocument, docKey: event.docKey ?? null, root: event.root, eventType: event.type, commandType: null, editorMounted: false })
      // #endregion
      return
    }
    // #region agent log
    console.debug('[document-reveal-effect]', { traceId: event.traceId ?? null, path: event.path, heading: event.heading ?? null, blockId: event.blockId ?? null, hostExists: revealHostExists, activeDocument, docKey: event.docKey ?? null, root: event.root, eventType: event.type, commandType: null, editorMounted: true })
    // #endregion
    const targetType = event.blockId ? 'block' : event.heading ? 'heading' : 'document'
    const targetValue = event.blockId ?? event.heading ?? event.path
    void Promise.resolve(revealNavigationAnchor({
      docKey: event.docKey ?? absolutePathToDocKeyOs(event.path, event.root),
      absolutePath: event.path,
      heading: event.heading,
      blockId: event.blockId,
      source: toInteractionSource(event.source),
      markdown: event.content,
    })).then(() => {
      // #region agent log
      console.debug('[reveal-host-scroll]', { traceId: event.traceId ?? null, success: true, promiseResolved: true, targetType, targetValue, path: event.path, activePath: getDocumentRuntimeSnapshot().activePath })
      // #endregion
    }).catch((error: unknown) => {
      // #region agent log
      console.debug('[reveal-host-scroll]', { traceId: event.traceId ?? null, success: false, promiseResolved: false, targetType, targetValue, path: event.path, activePath: getDocumentRuntimeSnapshot().activePath, error: error instanceof Error ? error.message : String(error) })
      // #endregion
    })
  })
}
