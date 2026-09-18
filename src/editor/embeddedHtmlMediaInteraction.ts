import type { MouseEvent as ReactMouseEvent } from 'react'

const EMBEDDED_HTML_SURFACE_SELECTOR =
  '.pm-luna-html-block-surface, .pm-luna-html-comment-block-surface, .pm-luna-html-inline-surface'

const EMBEDDED_HTML_MEDIA_RE = /<(?:img|video)\b/i

/** Whether a pointer event target lives inside a rendered HTML block/inline surface. */
export function isEmbeddedHtmlSurfaceTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && !!target.closest(EMBEDDED_HTML_SURFACE_SELECTOR)
}

/** Whether embedded HTML source may render img/video that needs a surface mousedown guard. */
export function embeddedHtmlContainsMedia(html: string): boolean {
  return EMBEDDED_HTML_MEDIA_RE.test(html)
}

/** Attach {@link handleEmbeddedHtmlMediaMouseDown} when the surface may contain media. */
export function shouldAttachEmbeddedHtmlMediaMouseDownGuard(html: string): boolean {
  return embeddedHtmlContainsMedia(html)
}

/**
 * Embedded HTML blocks/inline are PM atom node views. Without stopEvent, mousedown on
 * interactive markup (e.g. `<summary>`) retargets text selection to the block above.
 */
export function shouldStopEmbeddedHtmlSurfaceNodeViewEvent(event: Event): boolean {
  if (!isEmbeddedHtmlSurfaceTarget(event.target)) return false
  // Double-click is handled on the NodeViewWrapper to open source edit.
  if (event.type === 'dblclick') return false
  return true
}

/** @deprecated Use {@link shouldStopEmbeddedHtmlSurfaceNodeViewEvent}. */
export const shouldStopEmbeddedHtmlBlockNodeViewEvent = shouldStopEmbeddedHtmlSurfaceNodeViewEvent

/**
 * Block default navigation when clicking media inside embedded HTML
 * (e.g. README `<a href="#preview"><img>`). The editor `click` handler still resolves
 * workspace links and same-doc hash targets on the wrapping anchor.
 */
export function handleEmbeddedHtmlMediaMouseDown(event: ReactMouseEvent<HTMLElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return
  const media = (event.target as HTMLElement).closest('img, video')
  if (!media) return
  event.preventDefault()
  event.stopPropagation()
}
