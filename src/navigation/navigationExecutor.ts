import { NavigationEventType, type NavigationEvent } from './navigationEventTypes'
import {
  getDocumentMeta,
  normalizeDocKeyForNavigation,
  resolveCanonicalIdentity,
} from '../editor/knowledgeRuntime'
import { dispatchDocumentCommand, getDocumentRuntimeSnapshot } from '../documentRuntime/documentKernel'

export function executeNavigationEvent(event: NavigationEvent): void {
  void dispatchNavigationCommand(event)
}

async function dispatchNavigationCommand(event: NavigationEvent): Promise<void> {
  const traceId = typeof event.meta?.traceId === 'string' ? event.meta.traceId : event.id
  const identityInput = typeof event.docKey === 'string'
    ? normalizeDocKeyForNavigation(event.docKey)
    : (event.path ?? '')
  const identity = resolveCanonicalIdentity(identityInput)
  if (identity.status === 'unresolved') {
    return
  }
  const path = resolveNavigationPath(event, identity.docKey)
  const root = getDocumentRuntimeSnapshot().rootDir
  if (!path) {
    return
  }

  const activePath = getDocumentRuntimeSnapshot().activePath
  const activeIdentity = activePath ? resolveCanonicalIdentity(activePath) : null
  const sameDoc = Boolean(activeIdentity && activeIdentity.docKey === identity.docKey)
  const hasAnchor = hasRevealTarget(event)
  if (event.type === NavigationEventType.GRAPH_FOCUS && sameDoc && !hasAnchor) {
    return
  }

  switch (event.type) {
    case NavigationEventType.OPEN_NOTE:
    case NavigationEventType.OPEN_IN_TAB:
    case NavigationEventType.RESTORE:
    case NavigationEventType.GRAPH_FOCUS:
    case NavigationEventType.BACKLINK_FOCUS: {
      if (!root) {
        return
      }
      const commandType = resolveOpenCommandType(event)
      if (commandType === 'OPEN_DOCUMENT_REVEAL') {
        await dispatchDocumentCommand({
          type: 'OPEN_DOCUMENT_REVEAL',
          root,
          path,
          docKey: identity.docKey,
          heading: typeof event.meta?.heading === 'string' ? event.meta.heading : undefined,
          blockId: typeof event.meta?.blockId === 'string' ? event.meta.blockId : undefined,
          source: `navigation:${event.source}`,
          traceId,
        })
      } else {
        await dispatchDocumentCommand({
          type: commandType,
          root,
          path,
          source: `navigation:${event.source}`,
          traceId,
        })
      }
      return
    }

    case NavigationEventType.REVEAL:
      void path
      return
  }
}

function hasRevealTarget(event: NavigationEvent): boolean {
  return Boolean(
    (typeof event.meta?.heading === 'string' && event.meta.heading.trim()) ||
    (typeof event.meta?.blockId === 'string' && event.meta.blockId.trim()),
  )
}

const KNOWLEDGE_INTERACTION_SOURCES = new Set([
  'graph',
  'backlink',
  'search',
  'tag',
  'wiki',
  'editor',
])

function isKnowledgePanelNavigation(event: NavigationEvent): boolean {
  if (
    event.type === NavigationEventType.GRAPH_FOCUS ||
    event.type === NavigationEventType.BACKLINK_FOCUS
  ) {
    return true
  }
  const interactionSource = event.meta?.interactionSource
  if (typeof interactionSource === 'string' && KNOWLEDGE_INTERACTION_SOURCES.has(interactionSource)) {
    return true
  }
  return (
    event.source === 'search' ||
    event.source === 'graph' ||
    event.source === 'backlink' ||
    event.source === 'wiki' ||
    event.source === 'kernel'
  )
}

function resolveOpenCommandType(
  event: NavigationEvent,
): 'OPEN_DOCUMENT_IN_TAB' | 'OPEN_DOCUMENT_REVEAL' | 'OPEN_DOCUMENT' {
  if (shouldRevealDocument(event)) {
    return 'OPEN_DOCUMENT_REVEAL'
  }
  if (event.type === NavigationEventType.OPEN_IN_TAB || isKnowledgePanelNavigation(event)) {
    return 'OPEN_DOCUMENT_IN_TAB'
  }
  return 'OPEN_DOCUMENT'
}

function shouldRevealDocument(event: NavigationEvent): boolean {
  const hasAnchor = hasRevealTarget(event)
  return (
    hasAnchor &&
    (event.type === NavigationEventType.BACKLINK_FOCUS ||
      event.type === NavigationEventType.GRAPH_FOCUS)
  )
}

function resolveNavigationPath(event: NavigationEvent, docKey: string): string | null {
  if (event.path) return event.path
  const meta = getDocumentMeta(docKey)
  if (!meta?.absolutePath) return null
  return meta.absolutePath
}
