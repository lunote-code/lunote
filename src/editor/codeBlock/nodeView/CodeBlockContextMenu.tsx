import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import { ContextSubmenuFlyout } from '../../../app/components/ContextSubmenuFlyout'
import { useI18n } from '../../../i18n'
import { useClampedMenuPosition } from '../../../lib/useClampedMenuPosition'
import { useContextMenuKeyboardNav } from '../../../lib/useContextMenuKeyboardNav'
import type { LunaCodeLanguage } from '../../lunaCodeLanguages'
import {
  bumpRecentLanguageId,
  filterAndSortLanguages,
  readRecentLanguageIds,
  resolveCanonicalLanguageId,
} from '../../lunaCodeLanguages'

export type CodeBlockContextMenuState = {
  x: number
  y: number
  hasSelection: boolean
}

export type CodeBlockContextMenuPick =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'copyAll'
  | 'toggleFold'

type Props = {
  state: CodeBlockContextMenuState
  menuRef: RefObject<HTMLDivElement | null>
  folded: boolean
  canEdit: boolean
  languages: LunaCodeLanguage[]
  currentLanguageId: string | null
  onPick: (action: CodeBlockContextMenuPick) => void
  onLanguagePick: (id: string) => void
}

const SUBMENU_CLOSE_DELAY_MS = 140

function CodeBlockLanguageSubmenu({
  languages,
  currentLanguageId,
  onLanguagePick,
}: {
  languages: LunaCodeLanguage[]
  currentLanguageId: string | null
  onLanguagePick: (id: string) => void
}) {
  const { t } = useI18n()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentLanguageIds())

  const filtered = useMemo(
    () => filterAndSortLanguages(languages, query, recentIds),
    [languages, query, recentIds],
  )

  const normalizedCurrentId = useMemo(() => {
    const canonical = resolveCanonicalLanguageId(currentLanguageId ?? '') ?? currentLanguageId
    return canonical?.trim().toLowerCase() ?? null
  }, [currentLanguageId])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const keepOpen = useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), SUBMENU_CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
      return
    }
    setRecentIds(readRecentLanguageIds())
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1))
  }, [active, filtered.length])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  const commit = useCallback(
    (id: string) => {
      bumpRecentLanguageId(id)
      onLanguagePick(id)
    },
    [onLanguagePick],
  )

  const onSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus({ preventScroll: true })
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => Math.min(filtered.length - 1, index + 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => Math.max(0, index - 1))
        return
      }
      if (event.key === 'Enter' && filtered.length > 0) {
        event.preventDefault()
        commit(filtered[active]?.id ?? filtered[0].id)
      }
    },
    [active, commit, filtered],
  )

  return (
    <>
      <div
        className="file-ctx-submenu-wrap"
        onPointerEnter={keepOpen}
        onPointerLeave={scheduleClose}
      >
        <button
          ref={triggerRef}
          type="button"
          role="menuitem"
          className="file-ctx-item file-ctx-submenu-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onPointerEnter={keepOpen}
          onFocus={keepOpen}
          onClick={(event) => {
            event.stopPropagation()
            setOpen((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              keepOpen()
            }
          }}
        >
          <span>{t('ctx.codeBlock.language')}</span>
          <span className="file-ctx-submenu-chevron" aria-hidden>
            ›
          </span>
        </button>
      </div>
      <ContextSubmenuFlyout
        open={open}
        anchorRef={triggerRef}
        panelRef={panelRef}
        className="file-ctx-submenu-portal file-ctx-submenu--code-lang"
        ariaLabel={t('editor.codeLang.selectAria')}
        onPointerEnter={keepOpen}
        onPointerLeave={scheduleClose}
      >
        <div className="luna-code-lang-palette__search file-ctx-submenu--code-lang__search">
          <span className="luna-code-lang-palette__search-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20L16.5 16.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            className="luna-code-lang-palette__input"
            placeholder={t('editor.codeLang.filterPlaceholder')}
            value={query}
            aria-label={t('editor.codeLang.filterPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onSearchKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
        <div className="luna-code-lang-palette__list luna-overlay-scroll file-ctx-submenu--code-lang__list" role="menu">
          {filtered.length === 0 ? (
            <div className="luna-code-lang-palette__empty">{t('editor.codeLang.noMatch')}</div>
          ) : (
            filtered.map((lang, index) => {
              const isCurrent = normalizedCurrentId != null && lang.id.toLowerCase() === normalizedCurrentId
              return (
                <button
                  key={lang.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  className={`luna-code-lang-palette__row file-ctx-item${index === active ? ' luna-code-lang-palette__row--active' : ''}${isCurrent ? ' luna-code-lang-palette__row--current' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.stopPropagation()}
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
      </ContextSubmenuFlyout>
    </>
  )
}

export function CodeBlockContextMenu({
  state,
  menuRef,
  folded,
  canEdit,
  languages,
  currentLanguageId,
  onPick,
  onLanguagePick,
}: Props) {
  const { t } = useI18n()
  const { x, y, hasSelection } = state
  const openKey = `${x}:${y}:${folded}:${canEdit}:${hasSelection}`
  const { onKeyDown } = useContextMenuKeyboardNav(menuRef, openKey, { autoFocusOnOpen: false })
  const { x: menuX, y: menuY } = useClampedMenuPosition(menuRef, { x, y }, openKey)

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="file-ctx-menu"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        role="menuitem"
        className="file-ctx-item"
        disabled={!canEdit || !hasSelection}
        onClick={() => onPick('cut')}
      >
        {t('ctx.editor.cut')}
      </button>
      <button
        type="button"
        role="menuitem"
        className="file-ctx-item"
        disabled={!canEdit || !hasSelection}
        onClick={() => onPick('copy')}
      >
        {t('ctx.editor.copy')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!canEdit} onClick={() => onPick('paste')}>
        {t('ctx.editor.paste')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" disabled={!canEdit} onClick={() => onPick('selectAll')}>
        {t('ctx.editor.selectAll')}
      </button>
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('copyAll')}>
        {t('editor.codeBlock.copy')}
      </button>
      <div className="file-ctx-sep" role="separator" />
      <button type="button" role="menuitem" className="file-ctx-item" onClick={() => onPick('toggleFold')}>
        {folded ? t('editor.codeBlock.expand') : t('editor.codeBlock.collapse')}
      </button>
      <CodeBlockLanguageSubmenu
        languages={languages}
        currentLanguageId={currentLanguageId}
        onLanguagePick={onLanguagePick}
      />
    </div>
  )
}
