import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'

import { EmptyState } from '../../design-system/EmptyState'
import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { formatCommandShortcutDisplay } from '../../menu'
import { runWorkspaceSearch, type WorkspaceSearchIndexEntry } from '../search/workspaceSearch'
import { safeSearchSnippetHtml } from '../search/searchSnippet'
import type { SearchResult } from '../workspace/types'

export type WorkspaceGlobalSearchModalProps = {
  open: boolean
  query: string
  rootDir: string
  searchIndex: readonly WorkspaceSearchIndexEntry[]
  onQueryChange: (query: string) => void
  onClose: () => void
  onOpenDocument: (root: string, path: string) => void | Promise<void>
  inputRef?: RefObject<HTMLInputElement | null>
  t: TranslateFn
}

function isComposingKeyEvent(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  return e.nativeEvent.isComposing || e.key === 'Process'
}

export function WorkspaceGlobalSearchModal(props: WorkspaceGlobalSearchModalProps) {
  const { open, query, rootDir, searchIndex, onQueryChange, onClose, onOpenDocument, inputRef: inputRefProp, t } =
    props
  const hintId = useId()
  const fallbackInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = inputRefProp ?? fallbackInputRef
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(-1)
  const listboxId = useId()

  useFocusTrap(open, dialogEl, {
    initialFocusRef: inputRef,
    onEscape: onClose,
  })

  const placeholder = useMemo(
    () =>
      t('app.globalSearch.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-search'),
      }),
    [t],
  )

  const queryPending = query.trim() !== debouncedQuery.trim()
  const visibleResults = queryPending ? [] : results
  const highlightedIndex = hoverIndex >= 0 ? hoverIndex : activeIndex
  const activeOptionId =
    visibleResults.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
  const showLoading = loading || (queryPending && !!query.trim())
  const showEmpty = debouncedQuery.trim() && !showLoading && visibleResults.length === 0

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    setHoverIndex(-1)
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedQuery(query), 120)
    return () => window.clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    const dq = debouncedQuery.trim()
    if (q !== dq) {
      setResults([])
      setLoading(!!q)
    }
  }, [debouncedQuery, open, query])

  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (!q || !rootDir.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const hits = await runWorkspaceSearch(rootDir, debouncedQuery, searchIndex, 30)
      if (cancelled) return
      setResults(hits)
      setLoading(false)
      setActiveIndex(0)
      setHoverIndex(-1)
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open, rootDir, searchIndex])

  useEffect(() => {
    if (!open || visibleResults.length === 0) return
    const active = document.getElementById(`${listboxId}-option-${highlightedIndex}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, listboxId, open, visibleResults.length])

  useEffect(() => {
    if (visibleResults.length === 0) return
    setActiveIndex((i) => Math.min(i, visibleResults.length - 1))
  }, [visibleResults.length])

  const openResult = useCallback(
    (item: SearchResult) => {
      if (!rootDir.trim()) return
      void onOpenDocument(rootDir, item.path)
      onClose()
    },
    [onClose, onOpenDocument, rootDir],
  )

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKeyEvent(e)) return
    if (visibleResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIndex(-1)
      setActiveIndex((i) => Math.min(i + 1, visibleResults.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIndex(-1)
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = visibleResults[highlightedIndex]
      if (hit) openResult(hit)
    }
  }

  if (!open) return null

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={setDialogEl}
        className="command-palette global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('app.globalSearch.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="global-search-header">
          <p id={hintId} className="global-search-scope-hint">
            {t('app.globalSearch.scopeHint')}
          </p>
          <input
            ref={inputRef}
            className="command-palette-input global-search-input"
            role="combobox"
            aria-expanded={visibleResults.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-describedby={hintId}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value)
              setActiveIndex(0)
              setHoverIndex(-1)
            }}
            onKeyDown={onInputKeyDown}
            aria-label={t('app.globalSearch.aria')}
          />
        </div>
        <ul
          id={listboxId}
          className="command-palette-list luna-overlay-scroll"
          role="listbox"
          onMouseLeave={() => setHoverIndex(-1)}
        >
          {showLoading ? (
            <li className="command-palette-empty command-palette-loading" key="loading" role="status" aria-live="polite">
              <Icon name="refresh" size="sm" className="command-palette-loading-icon" tone="muted" />
              <span>{t('app.globalSearch.searching')}</span>
            </li>
          ) : showEmpty ? (
            <li className="command-palette-empty-item" key="empty">
              <EmptyState variant="compact" icon="search" title={t('app.globalSearch.empty')} />
            </li>
          ) : (
            visibleResults.map((item, idx) => (
              <li key={item.path} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  className="command-palette-item"
                  data-active={idx === highlightedIndex ? 'true' : undefined}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => openResult(item)}
                >
                  <span className="command-palette-item-row">
                    <span className="command-palette-item-label">{item.title}</span>
                  </span>
                  {item.snippet ? (
                    <span
                      className="command-palette-item-hint global-search-snippet"
                      dangerouslySetInnerHTML={{ __html: safeSearchSnippetHtml(item.snippet) }}
                    />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
