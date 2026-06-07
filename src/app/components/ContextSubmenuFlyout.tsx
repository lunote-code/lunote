import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

import { clampPointToViewport } from '../../lib/contextMenuPosition'

type Props = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  panelRef?: RefObject<HTMLDivElement | null>
  className?: string
  role?: string
  ariaLabel?: string
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  children: ReactNode
}

export function ContextSubmenuFlyout({
  open,
  anchorRef,
  panelRef,
  className,
  role = 'menu',
  ariaLabel,
  onPointerEnter,
  onPointerLeave,
  children,
}: Props) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return
    }

    let frame = 0
    const position = () => {
      const anchor = anchorRef.current
      const panel = panelRef?.current
      if (!anchor || !panel) return

      const anchorRect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      let left = anchorRect.right - 6
      if (left + width > window.innerWidth - 8) {
        left = anchorRect.left - width + 6
      }

      let top = anchorRect.top - 4
      const clamped = clampPointToViewport(left, top, width, height)
      left = clamped.x
      top = clamped.y

      setStyle({
        position: 'fixed',
        left,
        top,
        zIndex: 'var(--z-overlay-surface-popover-submenu)',
        visibility: 'visible',
        minWidth: Math.max(208, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [anchorRef, open, panelRef])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={style}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      {children}
    </div>,
    document.body,
  )
}
