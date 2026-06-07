import { getBlockLifecycle } from '../runtimeEngine/virtualBlockViewport'
import { markBlockNearOnly, notifyBlockIntersection } from './viewportRuntime'

/** True when the element overlaps the window viewport (height may be 0 before first preview). */
export function isElementLikelyInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  if (vh <= 0 || vw <= 0) return true
  return rect.bottom >= 0 && rect.top <= vh && rect.right >= 0 && rect.left <= vw
}

export function isElementNearViewport(element: HTMLElement, marginPx: number): boolean {
  const rect = element.getBoundingClientRect()
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  if (vh <= 0 || vw <= 0) return true
  const m = Math.max(0, marginPx)
  return (
    rect.bottom > -m &&
    rect.top < vh + m &&
    rect.right > -m &&
    rect.left < vw + m
  )
}

/**
 * Synchronously mark a block visible when its wrapper already intersects the viewport.
 * Avoids a race where IntersectionObserver reports hidden before layout completes after tab switches.
 */
export function seedBlockViewportIfVisible(blockId: string, element: HTMLElement | null): void {
  if (!blockId || !element) return
  if (!isElementLikelyInViewport(element)) return
  const lifecycle = getBlockLifecycle(blockId)
  if (lifecycle === 'destroyed' || lifecycle === 'visible') return
  notifyBlockIntersection(blockId, { intersecting: true, ratio: 0.25 })
}

/** Prime viewport gating on mount — visible blocks render immediately; near blocks preload. */
export function primeBlockViewportOnMount(
  blockId: string,
  element: HTMLElement | null,
  nearMarginPx = 160,
): void {
  if (!blockId || !element) return
  if (isElementLikelyInViewport(element)) {
    seedBlockViewportIfVisible(blockId, element)
    return
  }
  if (isElementNearViewport(element, nearMarginPx)) {
    const lifecycle = getBlockLifecycle(blockId)
    if (lifecycle === 'destroyed' || lifecycle === 'visible' || lifecycle === 'background') return
    markBlockNearOnly(blockId)
  }
}
