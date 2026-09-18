type VerticalSplitDragOptions = {
  handle: HTMLElement
  pointerId: number
  onMove: (clientX: number) => void
  onEnd?: () => void
}

export type VerticalSplitDragSession = {
  end: () => void
}

export function beginVerticalSplitDrag({
  handle,
  pointerId,
  onMove,
  onEnd,
}: VerticalSplitDragOptions): VerticalSplitDragSession {
  let ended = false

  const cleanup = () => {
    if (ended) return
    ended = true

    handle.classList.remove('is-resize-active')
    document.documentElement.classList.remove('is-split-dragging')
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')

    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('blur', onForceEnd)
    document.removeEventListener('visibilitychange', onVisibilityChange)

    try {
      handle.releasePointerCapture(pointerId)
    } catch {
      /* already released */
    }

    onEnd?.()
  }

  const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    onMove(ev.clientX)
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    cleanup()
  }

  const onForceEnd = () => {
    cleanup()
  }

  const onVisibilityChange = () => {
    if (document.hidden) cleanup()
  }

  handle.classList.add('is-resize-active')
  document.documentElement.classList.add('is-split-dragging')
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  try {
    handle.setPointerCapture(pointerId)
  } catch {
    /* ignore */
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('blur', onForceEnd)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return { end: cleanup }
}

/** Safety net for stale drag state after navigation / HMR / lost pointerup. */
export function resetVerticalSplitDragState(): void {
  document.documentElement.classList.remove('is-split-dragging')
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  for (const handle of document.querySelectorAll<HTMLElement>('.resize-handle-sidebar.is-resize-active')) {
    handle.classList.remove('is-resize-active')
  }
}
