import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onDismiss: () => void
}

type PanelPosition = {
  top: number
  left: number
}

const PANEL_GAP = 8
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function KnowledgeGraphToolbarHint({ t, anchorRef, open, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PanelPosition | null>(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const anchorRect = anchor.getBoundingClientRect()
    const panelWidth = panel.offsetWidth
    const panelHeight = panel.offsetHeight

    let top = anchorRect.bottom + PANEL_GAP
    if (top + panelHeight > window.innerHeight - VIEWPORT_PADDING) {
      top = anchorRect.top - panelHeight - PANEL_GAP
    }
    top = clamp(top, VIEWPORT_PADDING, window.innerHeight - panelHeight - VIEWPORT_PADDING)

    let left = anchorRect.right - panelWidth
    left = clamp(left, VIEWPORT_PADDING, window.innerWidth - panelWidth - VIEWPORT_PADDING)

    setPosition({ top, left })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition, t])

  if (!open) return null

  const panelStyle =
    position != null
      ? { top: position.top, left: position.left, visibility: 'visible' as const }
      : { top: -9999, left: -9999, visibility: 'hidden' as const }

  return createPortal(
    <div
      ref={panelRef}
      className="editor-graph-toolbar-hint"
      role="status"
      aria-live="polite"
      style={panelStyle}
    >
      <span className="editor-graph-toolbar-hint-text">{t('app.knowledge.graphToolbarHint')}</span>
      <button type="button" className="editor-graph-toolbar-hint-dismiss" onClick={onDismiss}>
        {t('app.knowledge.graphToolbarHintDismiss')}
      </button>
    </div>,
    document.body,
  )
}
