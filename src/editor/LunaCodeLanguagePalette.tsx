import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { LunaCodeLanguage } from './lunaCodeLanguages'
import { bumpRecentLanguageId, filterAndSortLanguages, readRecentLanguageIds } from './lunaCodeLanguages'

export type LunaCodeLanguagePaletteProps = {
  open: boolean
  anchorEl: HTMLElement | null
  languages: LunaCodeLanguage[]
  onPick: (id: string) => void
  onClose: () => void
}

/**
 * Command Palette style language selection: Portal + fuzzy filtering + keyboard navigation (↑↓ Enter Tab Esc).
 */
export function LunaCodeLanguagePalette({ open, anchorEl, languages, onPick, onClose }: LunaCodeLanguagePaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const recentIds = useMemo(() => readRecentLanguageIds(), [open])

  const filtered = useMemo(
    () => filterAndSortLanguages(languages, query, recentIds),
    [languages, query, recentIds],
  )

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
      return
    }
    setActive(0)
    const t = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1))
  }, [active, filtered.length])

  useEffect(() => {
    if (!open) return
    const row = listRef.current?.querySelector(`[data-palette-index="${active}"]`) as HTMLElement | null
    row?.scrollIntoView({ block: 'nearest' })
  }, [active, open, filtered])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (anchorEl?.contains(t as Node)) return
      if ((t as HTMLElement).closest?.('.luna-code-lang-palette')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDoc, true)
    return () => document.removeEventListener('pointerdown', onDoc, true)
  }, [open, anchorEl, onClose])

  const commit = useCallback(
    (id: string) => {
      bumpRecentLanguageId(id)
      onPick(id)
      onClose()
    },
    [onPick, onClose],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(filtered.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length === 0) return
        e.preventDefault()
        commit(filtered[active]?.id ?? filtered[0].id)
      }
    },
    [active, commit, filtered, onClose],
  )

  if (!open || !anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()
  const top = rect.bottom + 6
  const left = Math.min(rect.left, window.innerWidth - 328)

  const panel = (
    <div
      className="luna-code-lang-palette"
      role="listbox"
      aria-label="Select language"
      style={{
        position: 'fixed',
        top,
        left,
        width: 'min(320px, calc(100vw - 16px))',
        maxHeight: 'min(340px, 50vh)',
        zIndex: 10050,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="luna-code-lang-palette__search">
        <input
          ref={inputRef}
          type="text"
          className="luna-code-lang-palette__input"
          placeholder="Filter language…"
          value={query}
          aria-autocomplete="list"
          aria-controls="luna-code-lang-palette-list"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div id="luna-code-lang-palette-list" ref={listRef} className="luna-code-lang-palette__list">
        {filtered.length === 0 ? (
          <div className="luna-code-lang-palette__empty">No matching language</div>
        ) : (
          filtered.map((lang, index) => (
            <button
              key={lang.id}
              type="button"
              role="option"
              data-palette-index={index}
              aria-selected={index === active}
              className={`luna-code-lang-palette__row${index === active ? ' luna-code-lang-palette__row--active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => commit(lang.id)}
            >
              <span className="luna-code-lang-palette__name">{lang.displayName}</span>
              <span className="luna-code-lang-palette__id">{lang.id}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
