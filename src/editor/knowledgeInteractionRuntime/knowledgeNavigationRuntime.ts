import { getDocumentMeta, resolveDocKey } from '../knowledgeRuntime'
import { getWorkspaceState } from '../knowledgeRuntime'
import { emitInteractionEvent } from './interactionEvents'
import type { DocKey } from '../knowledgeRuntime/types'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import type { PreviewTarget } from './types'
import { resolvePreviewTarget } from './hoverPreviewRuntime'
import { getDocumentRuntimeSnapshot } from '../../documentRuntime/documentKernel'
import { absolutePathToDocKeyOs } from '../knowledgeOS/vaultRuntime'

export type NavigationTarget = {
  docKey: DocKey
  absolutePath: string
  heading?: string
  blockId?: string
}

const jumpHistory: NavigationTarget[] = []
let historyIndex = -1

function sameNavigationTarget(a: NavigationTarget | null | undefined, b: NavigationTarget | null | undefined): boolean {
  if (!a || !b) return false
  return (
    a.docKey === b.docKey &&
    a.absolutePath === b.absolutePath &&
    a.heading === b.heading &&
    a.blockId === b.blockId
  )
}

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
  const current = jumpHistory[historyIndex] ?? null
  if (sameNavigationTarget(current, nav)) return
  jumpHistory.splice(historyIndex + 1)
  jumpHistory.push(nav)
  historyIndex = jumpHistory.length - 1
  if (jumpHistory.length > 100) {
    jumpHistory.shift()
    historyIndex -= 1
  }
}

export function seedHistoryFromActiveContext(): void {
  const docKey = getActiveContextDocKey()
  if (!docKey) return
  const meta = getDocumentMeta(docKey)
  const nav: NavigationTarget = {
    docKey,
    absolutePath: meta?.absolutePath ?? '',
  }
  const current = jumpHistory[historyIndex] ?? null
  if (sameNavigationTarget(current, nav)) return
  if (historyIndex < 0) {
    jumpHistory.push(nav)
    historyIndex = 0
    return
  }
  jumpHistory.splice(historyIndex + 1)
  jumpHistory.push(nav)
  historyIndex = jumpHistory.length - 1
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
  if (active?.docKey) return active.docKey
  const activePath = getDocumentRuntimeSnapshot().activePath
  return activePath ? absolutePathToDocKeyOs(activePath) : null
}

export function resetKnowledgeNavigationRuntime(): void {
  jumpHistory.length = 0
  historyIndex = -1
}
