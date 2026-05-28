import { useEffect, useState, type RefObject } from 'react'
import type { PanelLayoutRect } from '../surfaceLayoutRuntime'

const MIN_TRUSTED_LAYOUT_PX = 48

/**
 * When tab/split layout reports 0 or stale size (common on Windows RDP/VPS first paint),
 * fall back to the panel host's getBoundingClientRect().
 */
export function useHostLayoutFallback(
  hostRef: RefObject<HTMLElement | null>,
  reported: PanelLayoutRect,
): PanelLayoutRect {
  const [hostRect, setHostRect] = useState<PanelLayoutRect>({ width: 0, height: 0 })

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.max(0, Math.floor(rect.width))
      const height = Math.max(0, Math.floor(rect.height))
      setHostRect((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }

    measure()
    const raf = requestAnimationFrame(measure)

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', measure)
      }
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [hostRef])

  const reportedOk =
    reported.width >= MIN_TRUSTED_LAYOUT_PX && reported.height >= MIN_TRUSTED_LAYOUT_PX
  if (reportedOk) return reported

  const hostOk =
    hostRect.width >= MIN_TRUSTED_LAYOUT_PX && hostRect.height >= MIN_TRUSTED_LAYOUT_PX
  if (hostOk) return hostRect

  return reported
}
