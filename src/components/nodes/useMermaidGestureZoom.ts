import { useEffect, useRef, type RefObject } from 'react'

import {
  touchPinchDistance,
  zoomFromPinchRatio,
  zoomFromSafariGestureScale,
  zoomFromWheelDelta,
} from './mermaidGestureZoom'

type Options = {
  disabled?: boolean
  onGestureStart?: () => void
}

type SafariGestureEvent = Event & { scale: number }

export function useMermaidGestureZoom(
  elementRef: RefObject<HTMLElement | null>,
  zoom: number,
  onZoomChange: (zoom: number) => void,
  options: Options = {},
): void {
  const zoomRef = useRef(zoom)
  const onZoomChangeRef = useRef(onZoomChange)
  const onGestureStartRef = useRef(options.onGestureStart)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  useEffect(() => {
    onGestureStartRef.current = options.onGestureStart
  }, [options.onGestureStart])

  useEffect(() => {
    const element = elementRef.current
    if (!element || options.disabled) return

    let touchStartDistance = 0
    let touchStartZoom = zoomRef.current
    let gestureStartZoom = zoomRef.current

    const notifyGestureStart = () => {
      onGestureStartRef.current?.()
    }

    const applyZoom = (next: number) => {
      zoomRef.current = next
      onZoomChangeRef.current(next)
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopPropagation()
      notifyGestureStart()
      applyZoom(zoomFromWheelDelta(zoomRef.current, event.deltaY))
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      touchStartDistance = touchPinchDistance(event.touches)
      touchStartZoom = zoomRef.current
      notifyGestureStart()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || touchStartDistance <= 0) return
      event.preventDefault()
      applyZoom(zoomFromPinchRatio(touchStartZoom, touchStartDistance, touchPinchDistance(event.touches)))
    }

    const resetTouchPinch = () => {
      touchStartDistance = 0
    }

    const onGestureStart = (event: Event) => {
      event.preventDefault()
      gestureStartZoom = zoomRef.current
      notifyGestureStart()
    }

    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const scale = (event as SafariGestureEvent).scale
      applyZoom(zoomFromSafariGestureScale(gestureStartZoom, scale))
    }

    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      resetTouchPinch()
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', resetTouchPinch)
    element.addEventListener('touchcancel', resetTouchPinch)
    element.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false })
    element.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false })
    element.addEventListener('gestureend', onGestureEnd as EventListener, { passive: false })

    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', resetTouchPinch)
      element.removeEventListener('touchcancel', resetTouchPinch)
      element.removeEventListener('gesturestart', onGestureStart as EventListener)
      element.removeEventListener('gesturechange', onGestureChange as EventListener)
      element.removeEventListener('gestureend', onGestureEnd as EventListener)
    }
  }, [elementRef, options.disabled])
}
