import { useRef } from 'react'
import { isSurfaceResizing } from '../layout/surfaceSplitLayoutRuntime'
import type { PanelLayoutRect } from '../surfaceLayoutRuntime'

/** Match useHostLayoutFallback / useGraphViewportLive — ignore 0×0 or 1×1 stub sizes. */
const MIN_TRUSTED_LAYOUT_PX = 48

/**
 * Freeze the panel layout size while dragging the splitter bar to avoid Graph SVG / Backlink recalculation.
 */
export function useFrozenSurfaceLayout(layout: PanelLayoutRect): PanelLayoutRect {
  const frozenRef = useRef<PanelLayoutRect>({ width: 0, height: 0 })

  if (!isSurfaceResizing()) {
    if (layout.width >= MIN_TRUSTED_LAYOUT_PX && layout.height >= MIN_TRUSTED_LAYOUT_PX) {
      frozenRef.current = {
        width: layout.width,
        height: layout.height,
      }
    }
  }

  return frozenRef.current
}
