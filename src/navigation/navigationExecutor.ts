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

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

async function dispatchNavigationCommand(event: NavigationEvent): Promise<void> {
  const traceId = typeof event.meta?.traceId === 'string' ? event.meta.traceId : event.id
  const eventType = event.type
  const agentLogEnabled = isAgentLogEnabled()
  if (agentLogEnabled) {
    // #region agent log
    console.debug('[navigation-executor-received]', { traceId, docKey: event.docKey ?? null, path: event.path ?? null, eventType, source: event.source })
    // #endregion
  }
  const identityInput = typeof event.docKey === 'string'
    ? normalizeDocKeyForNavigation(event.docKey)
    : (event.path ?? '')
  const identity = resolveCanonicalIdentity(identityInput)
  if (identity.status === 'unresolved') {
    if (agentLogEnabled) {
      // #region agent log
      if (event.source === 'graph') {
        console.debug('[graph-node-noop]', { traceId, identity, eventType, source: event.source, reason: 'unresolved_identity' })
      }
      console.debug('[navigation-noop]', { traceId, identity, eventType, source: event.source, reason: 'unresolved_identity' })
      // #endregion
    }
    return
  }
  const path = resolveNavigationPath(event, identity.docKey)
  const root = getDocumentRuntimeSnapshot().rootDir
  const incomingDocKey = identity.docKey
  const matchedRegistryKey = identity.docKey
  const willDispatch = Boolean(path && root)
  const activePath = getDocumentRuntimeSnapshot().activePath
  const activeIdentity = activePath ? resolveCanonicalIdentity(activePath) : null
  if (agentLogEnabled) {
    // #region agent log
    console.debug('[navigation-executor]', { traceId, docKey: identity.docKey, identity, resolvedPath: null, root, eventType, commandType: null, source: event.source, eventPath: event.path ?? null })
    console.debug('[navigation-resolved]', { traceId, incomingDocKey, resolvedPath: path, matchedRegistryKey, root, eventType, commandType: null, willDispatch })
    // #endregion
  }
  if (!path) {
    if (agentLogEnabled) {
      // #region agent log
      console.debug('[navigation-resolved-null]', { traceId, identity, root, eventType, source: event.source, reason: 'missing_resolved_path' })
      // #endregion
    }
    return
  }

  const sameDoc = Boolean(activeIdentity && activeIdentity.docKey === identity.docKey)
  const hasAnchor = hasRevealTarget(event)
  if (event.type === NavigationEventType.GRAPH_FOCUS && sameDoc && !hasAnchor) {
    if (agentLogEnabled) {
      // #region agent log
      console.debug('[navigation-noop]', {
        traceId,
        identity,
        eventType,
        source: event.source,
        reason: 'graph_same_doc_no_anchor',
      })
      // #endregion
    }
    return
  }

  switch (event.type) {
    case NavigationEventType.OPEN_NOTE:
    case NavigationEventType.OPEN_IN_TAB:
    case NavigationEventType.RESTORE:
    case NavigationEventType.GRAPH_FOCUS:
    case NavigationEventType.BACKLINK_FOCUS: {
      if (!root) {
        if (agentLogEnabled) {
          // #region agent log
          console.debug('[navigation-resolved-null]', { traceId, identity, root, eventType, source: event.source, reason: 'missing_root' })
          // #endregion
        }
        return
      }
      const commandType = event.type === NavigationEventType.OPEN_IN_TAB
        ? 'OPEN_DOCUMENT_IN_TAB'
        : shouldRevealDocument(event, identity.docKey, activeIdentity?.docKey ?? null)
          ? 'OPEN_DOCUMENT_REVEAL'
          : 'OPEN_DOCUMENT'
      if (agentLogEnabled) {
        // #region agent log
        console.debug('[document-command]', { traceId, docKey: identity.docKey, resolvedPath: path, root, eventType, commandType, source: `navigation:${event.source}` })
        // #endregion
      }
      if (commandType === 'OPEN_DOCUMENT_REVEAL') {
        if (agentLogEnabled) {
          // #region agent log
          console.debug('[document-command-dispatched]', { traceId, docKey: identity.docKey, resolvedPath: path, root, eventType, commandType, source: `navigation:${event.source}` })
          // #endregion
        }
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
        if (agentLogEnabled) {
          // #region agent log
          console.debug('[document-command-dispatched]', { traceId, docKey: identity.docKey, resolvedPath: path, root, eventType, commandType, source: `navigation:${event.source}` })
          // #endregion
        }
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

function shouldRevealDocument(
  event: NavigationEvent,
  targetDocKey: string,
  activeDocKey: string | null,
): boolean {
  const hasAnchor = hasRevealTarget(event)
  const sameDoc = Boolean(activeDocKey && activeDocKey === targetDocKey)
  const shouldReveal =
    hasAnchor &&
    (event.type === NavigationEventType.BACKLINK_FOCUS ||
      event.type === NavigationEventType.GRAPH_FOCUS)
  if (shouldReveal) {
    const traceId = typeof event.meta?.traceId === 'string' ? event.meta.traceId : event.id
    if (isAgentLogEnabled()) {
      // #region agent log
      console.debug('[reveal-triggered]', { traceId, targetDocKey, activeDocKey, hasAnchor, sameDoc, reason: event.type === NavigationEventType.GRAPH_FOCUS ? 'graph_with_anchor' : (sameDoc ? 'same_doc_backlink' : 'cross_doc_backlink_anchor') })
      // #endregion
    }
  }
  return shouldReveal
}

function resolveNavigationPath(event: NavigationEvent, docKey: string): string | null {
  if (event.path) return event.path
  return getDocumentMeta(docKey)?.absolutePath ?? null
}
