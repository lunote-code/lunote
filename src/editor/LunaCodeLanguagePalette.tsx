import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { LunaCodeLanguage } from './lunaCodeLanguages'
import { bumpRecentLanguageId, filterAndSortLanguages, readRecentLanguageIds } from './lunaCodeLanguages'
import { useI18n } from '../i18n'

type PanelPlacement = {
  top: number
  left: number
  width: number
  maxHeight: number
  openAbove: boolean
}

function computePanelPlacement(anchorEl: HTMLElement): PanelPlacement | null {
  const rect = anchorEl.getBoundingClientRect()
  if (rect.width <= 0 && rect.height <= 0) return null
  if (rect.bottom < 8 || rect.top > window.innerHeight - 8) return null

  const panelWidth = Math.min(320, window.innerWidth - 16)
  const panelMaxHeight = Math.min(360, window.innerHeight * 0.5)
  const gap = 8
  const spaceBelow = window.innerHeight - rect.bottom - gap - 12
  const spaceAbove = rect.top - gap - 12
  const openAbove = spaceBelow < panelMaxHeight * 0.55 && spaceAbove > spaceBelow
  const top = openAbove ? rect.top - gap : rect.bottom + gap
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
  return { top, left, width: panelWidth, maxHeight: panelMaxHeight, openAbove }
}

function collectScrollParents(el: HTMLElement): Array<HTMLElement | Window> {
  const roots: Array<HTMLElement | Window> = [window]
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const { overflow, overflowY, overflowX } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(`${overflow}${overflowY}${overflowX}`)) {
      roots.push(node)
    }
    node = node.parentElement
  }
  return roots
}

export type LunaCodeLanguagePaletteProps = {
  open: boolean
  anchorEl: HTMLElement | null
  languages: LunaCodeLanguage[]
  currentLanguageId?: string | null
  onPick: (id: string) => void
  onClose: () => void
}

/**
 * Command Palette style language selection: Portal + fuzzy filtering + keyboard navigation (↑↓ Enter Tab Esc).
 */
export function LunaCodeLanguagePalette({
  open,
  anchorEl,
  languages,
  currentLanguageId = null,
  onPick,
  onClose,
}: LunaCodeLanguagePaletteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<PanelPlacement | null>(null)

  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentLanguageIds())

  useEffect(() => {
    if (open) setRecentIds(readRecentLanguageIds())
  }, [open])

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
    if (!open || !anchorEl) {
      setPlacement(null)
      return
    }

    const syncPlacement = () => {
      const next = computePanelPlacement(anchorEl)
      if (!next) {
        onClose()
        return
      }
      setPlacement(next)
    }

    syncPlacement()
    const scrollParents = collectScrollParents(anchorEl)
    scrollParents.forEach((root) => {
      root.addEventListener('scroll', syncPlacement, { passive: true, capture: true })
    })
    window.addEventListener('resize', syncPlacement, { passive: true })

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncPlacement()
      })
      resizeObserver.observe(anchorEl)
      const wrap = anchorEl.closest('[data-luna-code-block-wrap]') as HTMLElement | null
      if (wrap && wrap !== anchorEl) resizeObserver.observe(wrap)
    }

    return () => {
      scrollParents.forEach((root) => {
        root.removeEventListener('scroll', syncPlacement, true)
      })
      window.removeEventListener('resize', syncPlacement)
      resizeObserver?.disconnect()
    }
  }, [open, anchorEl, onClose])

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

  const resolvedPlacement = placement ?? computePanelPlacement(anchorEl)
  if (!resolvedPlacement) return null

  const { top, left, width: panelWidth, maxHeight: panelMaxHeight, openAbove } = resolvedPlacement
  const normalizedCurrentId = currentLanguageId?.trim().toLowerCase() ?? null

  const panel = (
    <div
      className={`luna-code-lang-palette${openAbove ? ' luna-code-lang-palette--above' : ''}`}
      role="listbox"
      aria-label={t('editor.codeLang.selectAria')}
      style={{
        position: 'fixed',
        top,
        left,
        width: panelWidth,
        maxHeight: panelMaxHeight,
        transform: openAbove ? 'translateY(-100%)' : undefined,
        zIndex: 10050,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="luna-code-lang-palette__header">
        <span className="luna-code-lang-palette__title">{t('editor.codeLang.selectAria')}</span>
      </div>
      <div className="luna-code-lang-palette__search">
        <span className="luna-code-lang-palette__search-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20L16.5 16.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          className="luna-code-lang-palette__input"
          placeholder={t('editor.codeLang.filterPlaceholder')}
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
      <div
        id="luna-code-lang-palette-list"
        ref={listRef}
        className="luna-code-lang-palette__list luna-overlay-scroll"
      >
        {filtered.length === 0 ? (
          <div className="luna-code-lang-palette__empty">{t('editor.codeLang.noMatch')}</div>
        ) : (
          filtered.map((lang, index) => {
            const isCurrent = normalizedCurrentId != null && lang.id.toLowerCase() === normalizedCurrentId
            return (
              <button
                key={lang.id}
                type="button"
                role="option"
                data-palette-index={index}
                aria-selected={index === active}
                className={`luna-code-lang-palette__row${index === active ? ' luna-code-lang-palette__row--active' : ''}${isCurrent ? ' luna-code-lang-palette__row--current' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(lang.id)}
              >
                <span className="luna-code-lang-palette__check" aria-hidden>
                  {isCurrent ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12.5L10 17.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span className="luna-code-lang-palette__name">{lang.displayName}</span>
                <span className="luna-code-lang-palette__id">{lang.id}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
