import { useEffect } from 'react'

function listMenuItems(root: HTMLElement, itemSelector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(itemSelector)].filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/** Arrow/Home/End navigation between menu items while focus is inside the menu root. */
export function useMenuListKeyboard(
  open: boolean,
  menuRoot: HTMLElement | null,
  itemSelector: string,
): void {
  useEffect(() => {
    if (!open || !menuRoot) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End'
      ) {
        return
      }

      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !menuRoot.contains(active)) return

      const items = listMenuItems(menuRoot, itemSelector)
      if (items.length === 0) return

      const currentIndex = items.indexOf(active)
      let nextIndex = currentIndex

      if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = items.length - 1
      } else if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
      } else if (event.key === 'ArrowUp') {
        nextIndex =
          currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
      }

      if (nextIndex === currentIndex && currentIndex >= 0) return
      event.preventDefault()
      items[nextIndex]?.focus({ preventScroll: true })
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [itemSelector, menuRoot, open])
}
