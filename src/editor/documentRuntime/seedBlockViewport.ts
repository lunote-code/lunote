import { getBlockLifecycle } from '../runtimeEngine/virtualBlockViewport'
import { notifyBlockIntersection } from './viewportRuntime'

/** True when the element has layout and overlaps the window viewport. */
export function isElementLikelyInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  return rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw
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
