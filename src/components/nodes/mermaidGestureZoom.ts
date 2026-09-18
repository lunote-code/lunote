import { clampMermaidPreviewZoom } from './mermaidPreviewZoom'

/** Trackpad pinch / ctrl+wheel sensitivity. */
export const MERMAID_GESTURE_WHEEL_ZOOM_SENSITIVITY = 0.008

export function zoomFromWheelDelta(currentZoom: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * MERMAID_GESTURE_WHEEL_ZOOM_SENSITIVITY)
  return clampMermaidPreviewZoom(currentZoom * factor)
}

type TouchListLike = {
  readonly length: number
  item(index: number): Touch | null
}

export function touchPinchDistance(touches: TouchListLike): number {
  if (touches.length < 2) return 0
  const a = touches.item(0)
  const b = touches.item(1)
  if (!a || !b) return 0
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
}

export function zoomFromPinchRatio(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0 || distance <= 0) return startZoom
  return clampMermaidPreviewZoom(startZoom * (distance / startDistance))
}

export function zoomFromSafariGestureScale(startZoom: number, scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return startZoom
  return clampMermaidPreviewZoom(startZoom * scale)
}
