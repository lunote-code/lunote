export type VirtualWindow = {
  start: number
  end: number
  total: number
  overscan: number
}

export function computeVirtualWindow(
  scrollTop: number,
  itemHeight: number,
  viewportHeight: number,
  total: number,
  overscan = 4,
): VirtualWindow {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2
  const end = Math.min(total, start + visibleCount)
  return { start, end, total, overscan }
}

export function sliceVirtualItems<T>(items: T[], window: VirtualWindow): T[] {
  return items.slice(window.start, window.end)
}

const surfaceWindows = new Map<string, VirtualWindow>()

export function virtualizeSurface(surfaceId: string, window: VirtualWindow): VirtualWindow {
  surfaceWindows.set(surfaceId, window)
  return window
}

export function getSurfaceVirtualWindow(surfaceId: string): VirtualWindow | undefined {
  return surfaceWindows.get(surfaceId)
}

export function resetSurfaceVirtualization(): void {
  surfaceWindows.clear()
}
