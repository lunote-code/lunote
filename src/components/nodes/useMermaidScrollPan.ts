import { useEffect, useRef, type RefObject } from 'react'

const PAN_CLICK_SUPPRESS_MS = 450
const PAN_DRAG_THRESHOLD_PX = 3

type PanSession = {
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startScrollTop: number
}

type Options = {
  disabled?: boolean
  onPanStart?: () => void
  /** Rebind when preview content mounts or lightbox opens. */
  attachKey?: string | boolean
}

export function useMermaidScrollPan(
  scrollRef: RefObject<HTMLElement | null>,
  options: Options = {},
): {
  suppressClickUntilRef: RefObject<number>
} {
  const panSessionRef = useRef<PanSession | null>(null)
  const suppressClickUntilRef = useRef(0)
  const onPanStartRef = useRef(options.onPanStart)
  const disabledRef = useRef(options.disabled ?? false)

  useEffect(() => {
    onPanStartRef.current = options.onPanStart
  }, [options.onPanStart])

  useEffect(() => {
    disabledRef.current = options.disabled ?? false
  }, [options.disabled])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    element.style.setProperty('overflow', 'auto')
    element.style.setProperty('overscroll-behavior', 'contain')

    const onMouseDown = (event: MouseEvent) => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return
      if (disabledRef.current) return
      if (event.button !== 0) return
      if (!(event.target instanceof HTMLElement)) return
      if (event.target.closest('.pm-mermaid-preview-controls, .pm-mermaid-lightbox-controls')) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      panSessionRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: scrollElement.scrollLeft,
        startScrollTop: scrollElement.scrollTop,
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const session = panSessionRef.current
        const liveScroll = scrollRef.current
        if (!session || !liveScroll) return

        const deltaX = moveEvent.clientX - session.startClientX
        const deltaY = moveEvent.clientY - session.startClientY
        if (Math.hypot(deltaX, deltaY) >= PAN_DRAG_THRESHOLD_PX) {
          onPanStartRef.current?.()
          suppressClickUntilRef.current = Date.now() + PAN_CLICK_SUPPRESS_MS
        }

        liveScroll.scrollLeft = session.startScrollLeft - deltaX
        liveScroll.scrollTop = session.startScrollTop - deltaY
      }

      const endPan = () => {
        panSessionRef.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', endPan)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', endPan)
    }

    element.addEventListener('mousedown', onMouseDown, { capture: true })
    return () => {
      element.style.removeProperty('overflow')
      element.style.removeProperty('overscroll-behavior')
      element.removeEventListener('mousedown', onMouseDown, { capture: true })
    }
  }, [scrollRef, options.attachKey])

  return { suppressClickUntilRef }
}
