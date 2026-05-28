import { getDocumentMeta, resolveDocKey } from '../knowledgeRuntime'
import { getWorkspaceState } from '../knowledgeRuntime'
import { emitInteractionEvent } from './interactionEvents'
import type { DocKey } from '../knowledgeRuntime/types'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import type { PreviewTarget } from './types'
import { resolvePreviewTarget } from './hoverPreviewRuntime'

export type NavigationTarget = {
  docKey: DocKey
  absolutePath: string
  heading?: string
  blockId?: string
}

const jumpHistory: NavigationTarget[] = []
let historyIndex = -1

export function resolveNavigationTarget(target: PreviewTarget): NavigationTarget | null {
  const docKey = target.resolvedDocKey ?? resolveDocKey(target.docKey)
  if (!docKey) return null
  const meta = getDocumentMeta(docKey)
  return {
    docKey,
    absolutePath: meta?.absolutePath ?? '',
    heading: target.heading,
    blockId: target.blockId,
  }
}

export function goToDefinition(target: WikiLinkTarget): NavigationTarget | null {
  const nav = resolveNavigationTarget(resolvePreviewTarget(target))
  if (!nav) return null
  pushHistory(nav)
  return nav
}

export function pushHistory(nav: NavigationTarget): void {
  jumpHistory.splice(historyIndex + 1)
  jumpHistory.push(nav)
  historyIndex = jumpHistory.length - 1
  if (jumpHistory.length > 100) {
    jumpHistory.shift()
    historyIndex -= 1
  }
}

export function navigateBack(): NavigationTarget | null {
  if (historyIndex <= 0) return null
  historyIndex -= 1
  return jumpHistory[historyIndex] ?? null
}

export function navigateForward(): NavigationTarget | null {
  if (historyIndex >= jumpHistory.length - 1) return null
  historyIndex += 1
  return jumpHistory[historyIndex] ?? null
}

export function getBreadcrumb(docKey: DocKey): Array<{ label: string; docKey: DocKey }> {
  const parts = docKey.split('/').filter(Boolean)
  const crumbs: Array<{ label: string; docKey: DocKey }> = []
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    const meta = getDocumentMeta(acc)
    crumbs.push({ label: meta?.title ?? part, docKey: acc })
  }
  return crumbs
}

export function getJumpHistory(): readonly NavigationTarget[] {
  return jumpHistory
}

export function openInSplitHint(target: NavigationTarget): NavigationTarget {
  return target
}

export function selectBacklink(sourceDocKey: DocKey, targetDocKey: DocKey): void {
  emitInteractionEvent('backlink-selected', { sourceDocKey, targetDocKey })
}

export function getActiveContextDocKey(): DocKey | null {
  const ws = getWorkspaceState()
  const tabs = [...ws.tabs.values()]
  const active = tabs.find((t) => t.id === ws.panes[0]?.activeTabId)
  return active?.docKey ?? null
}

export function resetKnowledgeNavigationRuntime(): void {
  jumpHistory.length = 0
  historyIndex = -1
}
