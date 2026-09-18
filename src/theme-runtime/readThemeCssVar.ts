export function readThemeCssVar(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Opaque bitmap background for the drawing canvas (kept light for ink contrast). */
export function readDrawingCanvasBackgroundColor(fallback = '#ffffff'): string {
  return readThemeCssVar('--drawing-canvas-surface', fallback) || fallback
}
