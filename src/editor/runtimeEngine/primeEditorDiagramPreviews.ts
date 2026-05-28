import { seedBlockViewportIfVisible } from '../documentRuntime/seedBlockViewport'

const MERMAID_WRAP_SELECTOR = '[data-type="mermaid-block"][data-mermaid-block-id]'

/**
 * After a tab/document switch, ProseMirror node views remount before IntersectionObserver
 * settles. Prime visible Mermaid blocks so preview renders are not deferred by hidden gating.
 */
export function primeEditorDiagramPreviews(root: ParentNode | null | undefined): void {
  if (!root || typeof document === 'undefined') return
  const wraps = root.querySelectorAll<HTMLElement>(MERMAID_WRAP_SELECTOR)
  for (const wrap of wraps) {
    const blockId = wrap.getAttribute('data-mermaid-block-id')?.trim()
    if (!blockId) continue
    seedBlockViewportIfVisible(blockId, wrap)
  }
}

export function schedulePrimeEditorDiagramPreviews(
  resolveRoot: () => ParentNode | null | undefined,
): void {
  if (typeof requestAnimationFrame !== 'function') {
    primeEditorDiagramPreviews(resolveRoot())
    return
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      primeEditorDiagramPreviews(resolveRoot())
    })
  })
}
