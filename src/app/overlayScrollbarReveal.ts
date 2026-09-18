const REVEAL_CLASS = 'luna-scrollbar-reveal'
const GUTTER_HOVER_CLASS = 'luna-scrollbar-gutter-hover'
const SCROLL_IDLE_MS = 680
const GUTTER_HIT_PX = 12

/** Knowledge rail scroll regions that use tier-4r reveal on Windows/Linux WebView. */
export const KNOWLEDGE_PANEL_SCROLL_SELECTORS = [
  '.kos-backlink-scroll',
  '.kos-frontmatter-panel',
  '.kos-embed-panel',
  '.kos-search-results',
  '.kos-tags-scroll',
  '.kos-graph-discovery',
] as const

/** AI rail scroll regions (main list + floating auxiliary panels). */
export const AI_RAIL_SCROLL_SELECTORS = [
  '.ai-rail-scroll',
  '.ai-rail-context-inspector-panel',
  '.ai-rail-mention-picker',
  '.ai-rail-quick-actions-menu--floating',
  '.ai-rail-replace-diff',
  '.ai-grammar-issues-raw',
] as const

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

function collectScrollTargets(root: HTMLElement, selectors: readonly string[]): HTMLElement[] {
  const targets: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) return
      seen.add(node)
      targets.push(node)
    })
  }
  return targets
}

/**
 * Bind scroll/gutter reveal on matching scrollers under `root`.
 * Re-syncs when DOM children change (menus, discovery panel, etc.).
 */
export function observeOverlayScrollbarReveal(
  root: HTMLElement,
  selectors: readonly string[],
): () => void {
  const bindings = new Map<HTMLElement, () => void>()

  const sync = () => {
    const next = collectScrollTargets(root, selectors)
    const nextSet = new Set(next)
    for (const [el, cleanup] of bindings) {
      if (!nextSet.has(el)) {
        cleanup()
        bindings.delete(el)
      }
    }
    for (const el of next) {
      if (bindings.has(el)) continue
      bindings.set(el, bindOverlayScrollbarReveal(el))
    }
  }

  sync()
  const observer = new MutationObserver(sync)
  observer.observe(root, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    for (const cleanup of bindings.values()) cleanup()
    bindings.clear()
  }
}
