export const MERMAID_PREVIEW_MIN_ZOOM = 0.5
export const MERMAID_PREVIEW_MAX_ZOOM = 3
export const MERMAID_PREVIEW_ZOOM_STEP = 0.25
export const MERMAID_PREVIEW_DEFAULT_ZOOM = 1

export function clampMermaidPreviewZoom(value: number): number {
  const clamped = Math.min(MERMAID_PREVIEW_MAX_ZOOM, Math.max(MERMAID_PREVIEW_MIN_ZOOM, value))
  return Math.round(clamped * 100) / 100
}

export function formatMermaidPreviewZoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
