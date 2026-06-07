import { useLayoutEffect, useState, type RefObject } from 'react'

import { clampMenuElementPosition } from './contextMenuPosition'

type Anchor = { x: number; y: number }

export function useClampedMenuPosition(
  menuRef: RefObject<HTMLElement | null>,
  anchor: Anchor,
  remeasureKey = '',
): Anchor {
  const [position, setPosition] = useState(anchor)

  useLayoutEffect(() => {
    setPosition(anchor)
  }, [anchor.x, anchor.y])

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const clamped = clampMenuElementPosition(el, anchor.x, anchor.y)
    setPosition((prev) =>
      prev.x === clamped.x && prev.y === clamped.y ? prev : clamped,
    )
  }, [anchor.x, anchor.y, menuRef, remeasureKey])

  return position
}
