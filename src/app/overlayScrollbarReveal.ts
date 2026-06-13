const REVEAL_CLASS = 'luna-scrollbar-reveal'
const GUTTER_HOVER_CLASS = 'luna-scrollbar-gutter-hover'
const SCROLL_IDLE_MS = 900
const GUTTER_HIT_PX = 14

/**
 * macOS-style overlay scrollbars for document body on Windows/Linux WebView:
 * hidden by default, shown while scrolling or when the pointer is over the gutter.
 */
export function bindOverlayScrollbarReveal(el: HTMLElement): () => void {
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const showOnScroll = () => {
    el.classList.add(REVEAL_CLASS)
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      el.classList.remove(REVEAL_CLASS)
      idleTimer = null
    }, SCROLL_IDLE_MS)
  }

  const onMouseMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect()
    const nearRight = e.clientX >= rect.right - GUTTER_HIT_PX && e.clientX <= rect.right
    const inVertical = e.clientY >= rect.top && e.clientY <= rect.bottom
    if (nearRight && inVertical) {
      el.classList.add(GUTTER_HOVER_CLASS)
    } else {
      el.classList.remove(GUTTER_HOVER_CLASS)
    }
  }

  const onMouseLeave = () => {
    el.classList.remove(GUTTER_HOVER_CLASS)
  }

  el.addEventListener('scroll', showOnScroll, { passive: true })
  el.addEventListener('mousemove', onMouseMove, { passive: true })
  el.addEventListener('mouseleave', onMouseLeave, { passive: true })

  return () => {
    if (idleTimer) clearTimeout(idleTimer)
    el.removeEventListener('scroll', showOnScroll)
    el.removeEventListener('mousemove', onMouseMove)
    el.removeEventListener('mouseleave', onMouseLeave)
    el.classList.remove(REVEAL_CLASS, GUTTER_HOVER_CLASS)
  }
}
