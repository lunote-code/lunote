import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

type SubmenuScope = 'root' | 'export'

function collectMenuItems(container: HTMLElement | null): HTMLButtonElement[] {
  if (!container) return []
  return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')]
}

export function useContextMenuKeyboardNav(
  menuRef: RefObject<HTMLElement | null>,
  openKey: string,
  options?: {
    exportPanelRef?: RefObject<HTMLElement | null>
    exportEnabled?: boolean
    /** When false, keep editor focus on pointer-open (preserves selection highlight). Keyboard still focuses the menu. */
    autoFocusOnOpen?: boolean
  },
) {
  const pointerNavOnly = options?.autoFocusOnOpen === false
  const [scope, setScope] = useState<SubmenuScope>('root')
  const [activeIndex, setActiveIndex] = useState(() => (pointerNavOnly ? -1 : 0))
  const exportTriggerIndexRef = useRef(-1)

  const reset = useCallback(() => {
    setScope('root')
    setActiveIndex(pointerNavOnly ? -1 : 0)
  }, [pointerNavOnly])

  const getItems = useCallback((): HTMLButtonElement[] => {
    if (scope === 'export') return collectMenuItems(options?.exportPanelRef?.current ?? null)
    return collectMenuItems(menuRef.current)
  }, [menuRef, options?.exportPanelRef, scope])

  const focusItemAt = useCallback(
    (index: number) => {
      const items = getItems()
      if (items.length === 0) return
      const clamped = ((index % items.length) + items.length) % items.length
      setActiveIndex(clamped)
      items[clamped]?.focus({ preventScroll: true })
    },
    [getItems],
  )

  const focusItemAtRef = useRef(focusItemAt)
  focusItemAtRef.current = focusItemAt

  useEffect(() => {
    reset()
    if (options?.autoFocusOnOpen === false) return
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.focus()
      focusItemAtRef.current(0)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [openKey, menuRef, options?.autoFocusOnOpen, reset])

  useEffect(() => {
    if (scope === 'root') return
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusItemAtRef.current(0))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scope])

  useEffect(() => {
    const items = getItems()
    items.forEach((item, idx) => {
      item.classList.toggle('file-ctx-item--active', idx === activeIndex && activeIndex >= 0)
    })
    return () => {
      items.forEach((item) => item.classList.remove('file-ctx-item--active'))
    }
  }, [activeIndex, getItems, scope])

  useEffect(() => {
    if (!pointerNavOnly) return
    const menu = menuRef.current
    if (!menu) return
    const onMouseOver = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const item = target.closest('[role="menuitem"]')
      if (!(item instanceof HTMLButtonElement) || item.disabled) return
      if (!menu.contains(item)) return
      const items = collectMenuItems(menu)
      const idx = items.indexOf(item)
      if (idx >= 0) setActiveIndex(idx)
    }
    menu.addEventListener('mouseover', onMouseOver)
    return () => menu.removeEventListener('mouseover', onMouseOver)
  }, [menuRef, openKey, pointerNavOnly])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const items = getItems()
      if (items.length === 0) return

      const focusMenuIfNeeded = () => {
        const menu = menuRef.current
        if (!menu) return
        const active = document.activeElement
        if (active === menu || menu.contains(active)) return
        menu.focus()
        focusItemAt(activeIndex)
      }

      if (event.key === 'ArrowDown') {
        focusMenuIfNeeded()
        event.preventDefault()
        focusItemAt(activeIndex + 1)
        return
      }
      if (event.key === 'ArrowUp') {
        focusMenuIfNeeded()
        event.preventDefault()
        focusItemAt(activeIndex - 1)
        return
      }
      if (event.key === 'Home') {
        focusMenuIfNeeded()
        event.preventDefault()
        focusItemAt(0)
        return
      }
      if (event.key === 'End') {
        focusMenuIfNeeded()
        event.preventDefault()
        focusItemAt(items.length - 1)
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        focusMenuIfNeeded()
        event.preventDefault()
        items[activeIndex]?.click()
        return
      }
      if (event.key === 'ArrowRight' && scope === 'root') {
        focusMenuIfNeeded()
        if (options?.exportEnabled && activeIndex === exportTriggerIndexRef.current) {
          event.preventDefault()
          setScope('export')
        }
        return
      }
      if (event.key === 'ArrowLeft' && scope === 'export') {
        focusMenuIfNeeded()
        event.preventDefault()
        setScope('root')
        const restoreIndex = exportTriggerIndexRef.current
        window.requestAnimationFrame(() => focusItemAt(restoreIndex))
      }
    },
    [activeIndex, focusItemAt, getItems, menuRef, options?.exportEnabled, scope],
  )

  const registerExportTriggerIndex = useCallback((exportIndex: number) => {
    exportTriggerIndexRef.current = exportIndex
  }, [])

  return useMemo(
    () => ({
      scope,
      setScope,
      activeIndex,
      onKeyDown,
      registerExportTriggerIndex,
    }),
    [activeIndex, onKeyDown, registerExportTriggerIndex, scope],
  )
}
