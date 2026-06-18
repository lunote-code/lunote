import { getDocumentMeta, onKnowledgeDocumentOpened, openDocumentTab } from '../knowledgeRuntime'
import type { DocKey, WikiLinkTarget } from '../knowledgeRuntime/types'
import { refreshBacklinkPanel, setBacklinkPanelDocKey } from './backlinkPanelRuntime'
import { beginKnowledgeNavigation, endKnowledgeNavigation } from './graphInteractionGuard'
import { syncNoteGraphTopologyFromRoute } from './noteGraphRuntime'
import { absolutePathToDocKeyOs, docKeyToAbsolutePath } from './vaultRuntime'
import { resolveWikiTarget } from './wikiLinkRuntime'
import type { InteractionIntentSource } from './ui/interactionModel/types'
import type { NavigationEntry, NavigationSnapshot } from './types'

const stack: NavigationEntry[] = []
let stackIndex = -1
let current: NavigationEntry | null = null
let revision = 0
let lastPanelDocKey: DocKey | null = null
let lastNavigationSource: InteractionIntentSource | null = null
const listeners = new Set<() => void>()

function notify(): void {
  revision += 1
  listeners.forEach((fn) => fn())
}

function entryFromDocKey(
  docKey: DocKey,
  options?: { heading?: string; blockId?: string },
): NavigationEntry | null {
  const meta = getDocumentMeta(docKey)
  const absolutePath = meta?.absolutePath ?? docKeyToAbsolutePath(docKey)
  return {
    docKey,
    absolutePath,
    heading: options?.heading,
    blockId: options?.blockId,
    title: meta?.title ?? docKey.split('/').pop() ?? docKey,
  }
}

function pushStack(entry: NavigationEntry): void {
  stack.splice(stackIndex + 1)
  stack.push(entry)
  stackIndex = stack.length - 1
  if (stack.length > 100) {
    stack.shift()
    stackIndex -= 1
  }
}

/** Navigation only updates route (openDocumentTab); topology is explicitly synchronized by route; graph center is flushed by readiness barrier.*/
function syncKnowledgePanels(docKey: DocKey): void {
  if (lastPanelDocKey !== docKey) {
    lastPanelDocKey = docKey
    setBacklinkPanelDocKey(docKey)
    refreshBacklinkPanel(docKey)
  }
  syncNoteGraphTopologyFromRoute(docKey)
}

function openEntry(entry: NavigationEntry, recordHistory: boolean): NavigationEntry {
  const ownsNav = beginKnowledgeNavigation()
  try {
    current = entry
    if (recordHistory) pushStack(entry)
    openDocumentTab(entry.absolutePath, entry.docKey)
    onKnowledgeDocumentOpened(entry.absolutePath)
    syncKnowledgePanels(entry.docKey)
    notify()
    return entry
  } finally {
    if (ownsNav) {
      endKnowledgeNavigation()
    }
  }
}

export function navigateToDocKey(
  docKey: DocKey,
  options?: {
    heading?: string
    blockId?: string
    replaceHistory?: boolean
    source?: InteractionIntentSource
  },
): NavigationEntry | null {
  if (options?.source) lastNavigationSource = options.source
  const entry = entryFromDocKey(docKey, options)
  if (!entry) return null
  return openEntry(entry, !options?.replaceHistory)
}

export function navigateToWikiLink(
  target: WikiLinkTarget,
  source?: InteractionIntentSource,
): NavigationEntry | null {
  if (source) lastNavigationSource = source
  const resolved = resolveWikiTarget(target)
  if (!resolved.resolvedDocKey) return null
  return navigateToDocKey(resolved.resolvedDocKey, {
    heading: resolved.rawTarget.heading,
    blockId: resolved.rawTarget.blockId,
    source,
  })
}

export function peekLastNavigationSource(): InteractionIntentSource | null {
  return lastNavigationSource
}

export function consumeLastNavigationSource(): InteractionIntentSource | null {
  const s = lastNavigationSource
  lastNavigationSource = null
  return s
}

export function navigateToAbsolutePath(absolutePath: string): NavigationEntry | null {
  const docKey = absolutePathToDocKeyOs(absolutePath)
  return navigateToDocKey(docKey)
}

export function navigationBack(): NavigationEntry | null {
  if (stackIndex <= 0) return null
  stackIndex -= 1
  const entry = stack[stackIndex]
  if (!entry) return null
  return openEntry(entry, false)
}

export function navigationForward(): NavigationEntry | null {
  if (stackIndex >= stack.length - 1) return null
  stackIndex += 1
  const entry = stack[stackIndex]
  if (!entry) return null
  return openEntry(entry, false)
}

export function getNavigationSnapshot(): NavigationSnapshot {
  return {
    current,
    canBack: stackIndex > 0,
    canForward: stackIndex < stack.length - 1,
    stackIndex,
    stackLength: stack.length,
    revision,
  }
}

export function subscribeNavigation(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetNoteNavigationRuntime(): void {
  stack.length = 0
  stackIndex = -1
  current = null
  revision = 0
  lastPanelDocKey = null
  lastNavigationSource = null
  listeners.clear()
}
