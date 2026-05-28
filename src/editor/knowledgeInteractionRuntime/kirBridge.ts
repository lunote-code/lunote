/**
 * KIR ↔ Knowledge Runtime bridge (incremental hook, does not modify CBR).
 */
import { subscribeKnowledgeEvents, type KnowledgeEvent } from '../knowledgeRuntime'
import { getDocumentMeta } from '../knowledgeRuntime'
import type { ContentResolver } from './hoverPreviewRuntime'
import { setKnowledgeContentResolver } from './hoverPreviewRuntime'
import { setBacklinkContentResolver } from './backlinkSurfaceRuntime'
import { registerTermsFromDocument, unregisterDocumentTerms } from './unlinkedMentionRuntime'
import { graphNeighborhoodCache, previewCache, resetContextCaches } from './contextCache'
import { resetInteractionScheduler } from './interactionScheduler'
import { resetInteractionEvents } from './interactionEvents'
import { resetHoverPreviewRuntime } from './hoverPreviewRuntime'
import { resetBacklinkSurfaceRuntime } from './backlinkSurfaceRuntime'
import { resetContextGraphRuntime } from './contextGraphRuntime'
import { resetKnowledgeNavigationRuntime } from './knowledgeNavigationRuntime'
import { resetKnowledgePeekRuntime } from './knowledgePeekRuntime'
import { resetContextSurfaceRuntime } from './contextSurfaceRuntime'
import { resetUnlinkedMentionRuntime } from './unlinkedMentionRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

let unsubscribeKnowledge: (() => void) | null = null

export function setKirContentResolver(resolver: ContentResolver | null): void {
  setKnowledgeContentResolver(resolver)
  setBacklinkContentResolver(resolver)
}

export function initKnowledgeInteractionRuntime(): void {
  if (unsubscribeKnowledge) return
  unsubscribeKnowledge = subscribeKnowledgeEvents((ev: KnowledgeEvent) => {
    if (ev.kind === 'index-updated') {
      const p = ev.payload as KnowledgeEvent<'index-updated'>['payload']
      onKirDocumentIndexed(p.docKey)
      return
    }
    if (ev.kind === 'document-removed') {
      const p = ev.payload as KnowledgeEvent<'document-removed'>['payload']
      onKirDocumentRemoved(p.docKey)
      return
    }
    if (ev.kind === 'document-renamed') {
      const p = ev.payload as KnowledgeEvent<'document-renamed'>['payload']
      previewCache.invalidateByPrefix(`preview:${p.fromKey}`)
      graphNeighborhoodCache.invalidateByPrefix(`ctx:${p.fromKey}`)
      unregisterDocumentTerms(p.fromKey)
    }
  })
}

export function onKirDocumentIndexed(docKey: DocKey): void {
  const meta = getDocumentMeta(docKey)
  if (!meta) return
  registerTermsFromDocument(docKey, meta.title, meta.outboundTags)
  previewCache.invalidateByPrefix(`preview:${docKey}`)
  graphNeighborhoodCache.invalidateByPrefix(`ctx:${docKey}`)
}

export function onKirDocumentRemoved(docKey: DocKey): void {
  unregisterDocumentTerms(docKey)
  previewCache.invalidateByPrefix(`preview:${docKey}`)
  graphNeighborhoodCache.invalidateByPrefix(`ctx:${docKey}`)
}

export function resetKnowledgeInteractionRuntime(): void {
  if (unsubscribeKnowledge) {
    unsubscribeKnowledge()
    unsubscribeKnowledge = null
  }
  resetContextCaches()
  resetInteractionScheduler()
  resetInteractionEvents()
  resetHoverPreviewRuntime()
  resetBacklinkSurfaceRuntime()
  resetContextGraphRuntime()
  resetKnowledgeNavigationRuntime()
  resetKnowledgePeekRuntime()
  resetContextSurfaceRuntime()
  resetUnlinkedMentionRuntime()
  setKirContentResolver(null)
}
