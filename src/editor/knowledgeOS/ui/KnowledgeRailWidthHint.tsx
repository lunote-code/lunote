import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useI18n } from '../../../i18n'
import { clampMenuElementPosition } from '../../../lib/contextMenuPosition'

const STORAGE_KEY = 'luna:knowledge.railWidthHint.dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

type Props = {
  visible: boolean
  anchorRef: RefObject<HTMLElement | null>
}

export function KnowledgeRailWidthHint({ visible, anchorRef }: Props) {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(isDismissed)
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    left: -9999,
    top: 0,
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  useLayoutEffect(() => {
    if (!visible || dismissed) return

    let frame = 0
    const position = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const preferredLeft = anchorRect.left - width - 8
      const preferredTop = anchorRect.top + anchorRect.height / 2 - height / 2
      const { x: left, y: top } = clampMenuElementPosition(panel, preferredLeft, preferredTop)
      setStyle({ left, top, visibility: 'visible' })
    }

    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchorRef, dismissed, visible])

  if (!visible || dismissed) return null

  return createPortal(
    <div
      ref={panelRef}
      className="kos-rail-width-hint"
      data-testid="kos-rail-width-hint"
      role="note"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <span className="kos-rail-width-hint-text">{t('knowledge.railWidthHint')}</span>
      <button
        type="button"
        className="kos-rail-width-hint-dismiss"
        data-testid="kos-rail-width-hint-dismiss"
        onClick={dismiss}
      >
        {t('knowledge.railWidthHintDismiss')}
      </button>
    </div>,
    document.body,
  )
}
