import {
  getBlockLifecycle,
  markBlockHidden,
  markBlockNearViewport,
  markBlockVisible,
} from '../runtimeEngine/virtualBlockViewport'
import {
  isBlockVirtualized,
  shouldRenderBlockPreview,
} from '../runtimeEngine/virtualBlockViewport'
import { arbitrateAuthority } from './deterministic'
import { bumpDocumentTick } from './documentClock'
import { mapViewportToGraphPhase, transitionBlockPhase } from './lifecycleGraph'

export type ScrollAnchor = {
  blockId: string | null
  scrollTop: number
  ratio: number
}

export type ViewportWindow = {
  visibleBlockIds: string[]
  nearBlockIds: string[]
  virtualizedBlockIds: string[]
}

const visibleBlocks = new Set<string>()
const nearBlocks = new Set<string>()
let scrollAnchor: ScrollAnchor = { blockId: null, scrollTop: 0, ratio: 0 }
let scrollRoot: HTMLElement | null = null
let viewportRevision = 0
const viewportListeners = new Set<() => void>()
let viewportEmitScheduled = false

function emitViewportRuntimeUpdate(): void {
  viewportRevision += 1
  for (const listener of viewportListeners) listener()
}

/** Coalesce multiple block intersection updates during one scroll frame. */
function scheduleViewportRuntimeEmit(): void {
  if (viewportEmitScheduled) return
  viewportEmitScheduled = true
  requestAnimationFrame(() => {
    viewportEmitScheduled = false
    emitViewportRuntimeUpdate()
  })
}

export function subscribeViewportRuntime(listener: () => void): () => void {
  viewportListeners.add(listener)
  return () => {
    viewportListeners.delete(listener)
  }
}

export function getViewportRuntimeRevision(): number {
  return viewportRevision
}

export function registerScrollRoot(element: HTMLElement | null): void {
  scrollRoot = element
}

export function getScrollRoot(): HTMLElement | null {
  return scrollRoot
}

export function setScrollAnchor(anchor: Partial<ScrollAnchor>): void {
  scrollAnchor = { ...scrollAnchor, ...anchor }
  bumpDocumentTick('viewport')
  scheduleViewportRuntimeEmit()
}

export function getScrollAnchor(): Readonly<ScrollAnchor> {
  return scrollAnchor
}

export function notifyBlockIntersection(
  blockId: string,
  state: { intersecting: boolean; ratio: number; suspended?: boolean },
): void {
  if (!blockId) return
  const prevShouldRender = shouldRenderBlockPreview(blockId)
  arbitrateAuthority({ domain: 'viewport', incoming: 'viewport', blockId })

  if (state.intersecting) {
    if (state.ratio > 0.05) {
      visibleBlocks.add(blockId)
      nearBlocks.add(blockId)
      markBlockVisible(blockId)
    } else {
      visibleBlocks.delete(blockId)
      nearBlocks.add(blockId)
      markBlockNearViewport(blockId)
    }
  } else {
    visibleBlocks.delete(blockId)
    const lifecycle = getBlockLifecycle(blockId)
    const preLayout =
      lifecycle === 'mount' || lifecycle === 'background' || lifecycle === 'virtualized'
    if (preLayout && state.ratio === 0) {
      nearBlocks.add(blockId)
      markBlockNearViewport(blockId)
    } else if (!nearBlocks.has(blockId)) {
      markBlockHidden(blockId)
    } else {
      markBlockNearViewport(blockId)
    }
  }

  const phase = mapViewportToGraphPhase({
    visible: visibleBlocks.has(blockId),
    near: nearBlocks.has(blockId),
    suspended: state.suspended ?? false,
  })
  transitionBlockPhase(blockId, phase)

  const nextShouldRender = shouldRenderBlockPreview(blockId)
  if (prevShouldRender !== nextShouldRender) {
    bumpDocumentTick('viewport')
    scheduleViewportRuntimeEmit()
  }
}

export function markBlockNearOnly(blockId: string): void {
  const prevShouldRender = shouldRenderBlockPreview(blockId)
  nearBlocks.add(blockId)
  markBlockNearViewport(blockId)
  transitionBlockPhase(blockId, 'background')
  if (shouldRenderBlockPreview(blockId) !== prevShouldRender) {
    bumpDocumentTick('viewport')
    scheduleViewportRuntimeEmit()
  }
}

export function getViewportWindow(): ViewportWindow {
  const virtualized: string[] = []
  for (const id of nearBlocks) {
    if (!visibleBlocks.has(id) && isBlockVirtualized(id)) virtualized.push(id)
  }
  return {
    visibleBlockIds: [...visibleBlocks],
    nearBlockIds: [...nearBlocks],
    virtualizedBlockIds: virtualized,
  }
}

export function shouldBlockRenderInViewport(blockId: string): boolean {
  return shouldRenderBlockPreview(blockId)
}

export function observeBlockViewport(
  blockId: string,
  element: HTMLElement,
  options?: { rootMargin?: string; suspended?: boolean },
): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.target !== element) continue
        notifyBlockIntersection(blockId, {
          intersecting: e.isIntersecting,
          ratio: e.intersectionRatio,
          suspended: options?.suspended,
        })
      }
    },
    {
      root: null,
      rootMargin: options?.rootMargin ?? '160px',
      threshold: [0, 0.05],
    },
  )
  io.observe(element)
  return () => {
    io.disconnect()
    notifyBlockIntersection(blockId, { intersecting: false, ratio: 0 })
  }
}

export function clearViewportRuntime(blockId?: string): void {
  if (blockId) {
    visibleBlocks.delete(blockId)
    nearBlocks.delete(blockId)
    emitViewportRuntimeUpdate()
    return
  }
  visibleBlocks.clear()
  nearBlocks.clear()
  scrollAnchor = { blockId: null, scrollTop: 0, ratio: 0 }
  emitViewportRuntimeUpdate()
}
