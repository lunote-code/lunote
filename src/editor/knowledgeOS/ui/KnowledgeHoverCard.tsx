import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getHoverSurfaceSnapshot,
  hideHoverSurface,
  showHoverSurface,
  subscribeHoverSurface,
  ensureHoverSurfaceListening,
} from '../../knowledgeSurfaceRuntime'
import { getCachedPreview, resolvePreviewTarget } from '../../knowledgeInteractionRuntime'
import type { WikiLinkTarget } from '../../knowledgeRuntime/types'

type Props = {
  hoverId: string | null
}

export function KnowledgeHoverCard({ hoverId }: Props) {
  const [, bump] = useState(0)
  useEffect(() => {
    ensureHoverSurfaceListening()
    return subscribeHoverSurface(() => bump((n) => n + 1))
  }, [])

  if (!hoverId) return null
  const snap = getHoverSurfaceSnapshot(hoverId)
  if (!snap || snap.hoverPhase !== 'hover-visible' || !snap.target || !snap.anchor) return null

  const preview = getCachedPreview(resolvePreviewTarget(snap.target))
  const { anchor } = snap

  return createPortal(
    <div
      id={`wiki-hover-${hoverId}`}
      className="kos-hover-card"
      role="tooltip"
      aria-live="polite"
      style={{ left: anchor.x + 12, top: anchor.y + 12 }}
      onMouseLeave={() => hideHoverSurface(hoverId)}
    >
      <div className="kos-hover-title">{preview?.title ?? snap.target.docKey}</div>
      {preview?.plainSnippet ? (
        <p className="kos-hover-excerpt">{preview.plainSnippet}</p>
      ) : null}
    </div>,
    document.body,
  )
}

export function showWikiHover(target: WikiLinkTarget, clientX: number, clientY: number): string {
  return showHoverSurface(target, { x: clientX, y: clientY })
}

export function hideWikiHover(id: string | null): void {
  if (id) hideHoverSurface(id)
}
