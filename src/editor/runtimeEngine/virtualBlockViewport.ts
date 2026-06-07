export type BlockLifecycle =
  | 'mount'
  | 'visible'
  | 'hidden'
  | 'virtualized'
  | 'background'
  | 'destroyed'

type BlockViewportState = {
  lifecycle: BlockLifecycle
  inViewport: boolean
  nearViewport: boolean
}

const states = new Map<string, BlockViewportState>()

function getOrCreate(blockId: string): BlockViewportState {
  let s = states.get(blockId)
  if (!s) {
    s = { lifecycle: 'mount', inViewport: false, nearViewport: false }
    states.set(blockId, s)
  }
  return s
}

export function getBlockLifecycle(blockId: string): BlockLifecycle {
  return states.get(blockId)?.lifecycle ?? 'mount'
}

export function markBlockVisible(blockId: string): void {
  const s = getOrCreate(blockId)
  s.inViewport = true
  s.nearViewport = true
  if (s.lifecycle !== 'destroyed') {
    s.lifecycle = 'visible'
  }
}

export function markBlockNearViewport(blockId: string): void {
  const s = getOrCreate(blockId)
  s.nearViewport = true
  if (s.lifecycle === 'mount' || s.lifecycle === 'hidden' || s.lifecycle === 'virtualized') {
    s.lifecycle = 'background'
  }
}

export function markBlockHidden(blockId: string): void {
  const s = getOrCreate(blockId)
  s.inViewport = false
  if (s.lifecycle !== 'destroyed') {
    s.lifecycle = s.nearViewport ? 'virtualized' : 'hidden'
  }
}

export function markBlockDestroyed(blockId: string): void {
  const s = getOrCreate(blockId)
  s.lifecycle = 'destroyed'
  s.inViewport = false
  s.nearViewport = false
}

export function clearBlockViewport(blockId?: string): void {
  if (blockId) states.delete(blockId)
  else states.clear()
}

/** Whether preview level rendering should be performed (inside the viewport or with preloading)*/
export function shouldRenderBlockPreview(blockId: string): boolean {
  const s = states.get(blockId)
  if (!s || s.lifecycle === 'destroyed' || s.lifecycle === 'hidden') return false
  // Do not render on initial mount — wait for IntersectionObserver / seedBlockViewportIfVisible.
  // Otherwise every Mermaid block in a long document queues preview work on cold open and blocks UI.
  return s.lifecycle === 'visible' || s.lifecycle === 'background'
}

/** Is it possible to skip heavy diagram rendering entirely?*/
export function isBlockVirtualized(blockId: string): boolean {
  const s = states.get(blockId)
  return s?.lifecycle === 'virtualized' || s?.lifecycle === 'hidden'
}
