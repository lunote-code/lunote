import { primeBlockViewportOnMount } from '../documentRuntime/seedBlockViewport'
import { debugMermaid } from '../mermaid/mermaidDebug'

const MERMAID_WRAP_SELECTOR = '[data-type="mermaid-block"]'

/**
 * After a tab/document switch, ProseMirror node views remount before IntersectionObserver
 * settles. Prime visible Mermaid blocks so preview renders are not deferred by hidden gating.
 */
export function primeEditorDiagramPreviews(root: ParentNode | null | undefined): void {
  if (!root || typeof document === 'undefined') return
  const wraps = root.querySelectorAll<HTMLElement>(MERMAID_WRAP_SELECTOR)
  debugMermaid('prime_editor_previews', {
    wrapCount: wraps.length,
  })
  for (const wrap of wraps) {
    const blockId = wrap.getAttribute('data-mermaid-block-id')?.trim()
    if (!blockId) continue
    primeBlockViewportOnMount(blockId, wrap)
  }
}

export function schedulePrimeEditorDiagramPreviews(
  resolveRoot: () => ParentNode | null | undefined,
): void {
  let attempts = 0
  const maxAttempts = 6

  const run = () => {
    attempts += 1
    const root = resolveRoot()
    primeEditorDiagramPreviews(root)

    const hasPendingWraps = Boolean(
      root?.querySelector?.(`${MERMAID_WRAP_SELECTOR}:not([data-mermaid-block-id])`),
    )
    const hasResolvedWraps = Boolean(root?.querySelector?.('[data-type="mermaid-block"][data-mermaid-block-id]'))
    debugMermaid('prime_editor_previews_attempt', {
      attempts,
      hasPendingWraps,
      hasResolvedWraps,
    })
    if (attempts >= maxAttempts || (hasResolvedWraps && !hasPendingWraps)) return

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run)
      return
    }
    setTimeout(run, 16)
  }

  queueMicrotask(run)
}
