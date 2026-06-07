import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
  )
}

export function useFocusTrap(
  open: boolean,
  container: HTMLElement | null,
  options?: {
    initialFocus?: HTMLElement | null
    /** Read at focus time so ref is populated after mount (preferred over initialFocus).*/
    initialFocusRef?: RefObject<HTMLElement | null>
    onEscape?: () => void
  },
) {
  const initialFocus = options?.initialFocus ?? null
  const initialFocusRef = options?.initialFocusRef
  const onEscapeRef = useRef(options?.onEscape)
  onEscapeRef.current = options?.onEscape

  // Restore focus only when the trap closes (open true → false), not when deps churn while open.
  useEffect(() => {
    if (!open) return
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open || !container) return
    const focusInitial = () => {
      const fromRef = initialFocusRef?.current ?? null
      const candidate = fromRef ?? initialFocus
      const target =
        candidate && container.contains(candidate) ? candidate : getFocusableElements(container)[0]
      target?.focus({ preventScroll: true })
    }
    const frame = window.requestAnimationFrame(focusInitial)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscapeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (event.shiftKey) {
        if (!active || active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        }
        return
      }
      if (!active || active === last || !container.contains(active)) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    container.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [container, initialFocus, open])
}
