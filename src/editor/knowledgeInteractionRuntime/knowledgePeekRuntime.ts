import { emitInteractionEvent } from './interactionEvents'
import { getCachedPreview, resolvePreviewTarget, startHoverPreview } from './hoverPreviewRuntime'
import { goToDefinition, resolveNavigationTarget } from './knowledgeNavigationRuntime'
import { getBacklinkSurfaceSync } from './backlinkSurfaceRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import type { PeekRequest, PreviewTarget } from './types'

export type PeekState = {
  id: string
  request: PeekRequest
  target: PreviewTarget
  navigation: ReturnType<typeof resolveNavigationTarget>
}

const openPeeks = new Map<string, PeekState>()
let peekSeq = 0

export function openPeek(request: PeekRequest): PeekState | null {
  const target: PreviewTarget = resolvePreviewTarget(request.target)
  const navigation = resolveNavigationTarget(target)
  if (!navigation && request.kind !== 'backlink') return null

  const id = `peek-${++peekSeq}`
  const state: PeekState = { id, request, target, navigation }
  openPeeks.set(id, state)

  if (request.kind === 'backlink' && request.sourceDocKey) {
    getBacklinkSurfaceSync(request.sourceDocKey)
  } else {
    startHoverPreview(id, target)
  }

  emitInteractionEvent('peek-opened', {
    peekId: id,
    docKey: navigation?.docKey ?? target.resolvedDocKey ?? target.docKey,
  })
  return state
}

export function closePeek(peekId: string): void {
  if (!openPeeks.has(peekId)) return
  openPeeks.delete(peekId)
  emitInteractionEvent('peek-closed', { peekId })
}

export function peekDefinition(target: import('../knowledgeRuntime/types').WikiLinkTarget): PeekState | null {
  return openPeek({ kind: 'definition', target })
}

export function peekReferences(
  target: import('../knowledgeRuntime/types').WikiLinkTarget,
  sourceDocKey?: DocKey,
): PeekState | null {
  return openPeek({ kind: 'reference', target, sourceDocKey })
}

export function cmdClickWikiLink(
  target: import('../knowledgeRuntime/types').WikiLinkTarget,
  modifiers?: { altKey?: boolean },
): {
  action: 'navigate' | 'peek'
  navigation?: ReturnType<typeof goToDefinition>
  peek?: PeekState
} {
  if (modifiers?.altKey) {
    const peek = peekDefinition(target)
    return { action: 'peek', peek: peek ?? undefined }
  }
  const navigation = goToDefinition(target)
  return { action: 'navigate', navigation: navigation ?? undefined }
}

export function getPeekPreview(peekId: string) {
  const state = openPeeks.get(peekId)
  if (!state) return null
  return getCachedPreview(resolvePreviewTarget(state.request.target))
}

export function getOpenPeeks(): PeekState[] {
  return [...openPeeks.values()]
}

export function resetKnowledgePeekRuntime(): void {
  openPeeks.clear()
  peekSeq = 0
}
