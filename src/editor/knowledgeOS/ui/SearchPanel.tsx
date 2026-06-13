import { forwardRef, useCallback, useEffect, useId, useState, type RefObject } from 'react'

import { EmptyState } from '../../../design-system/EmptyState'
import { Icon } from '../../../design-system/icons'
import type { SearchHit } from '../../knowledgeRuntime/types'
import { runKnowledgeSearch } from '../knowledgeSearchRuntime'
import { useSearchSlice } from './useKnowledgeOSSlice'
import { dispatchKnowledgeNavigateHit } from './interactionTransaction'
import { useI18n } from '../../../i18n'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  autoFocus?: boolean
  onHitOpened?: () => void
  /** When false, input is rendered in the rail/sidebar header; bind keyboard via externalInputRef. */
  showInput?: boolean
  externalInputRef?: RefObject<HTMLInputElement | null>
}

function isComposingKeyEvent(e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>): boolean {
  return ('nativeEvent' in e && e.nativeEvent.isComposing) || e.key === 'Process'
}

export const SearchPanel = forwardRef<HTMLInputElement, Props>(function SearchPanel(
  { query, onQueryChange, autoFocus, onHitOpened, showInput = true, externalInputRef },
  inputRef,
) {
  const { t } = useI18n()
  const snap = useSearchSlice()
  const listboxId = useId()
  const [debounced, setDebounced] = useState(query)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(-1)

  const boundInputRef = showInput ? inputRef : externalInputRef

  useEffect(() => {
    if (!autoFocus || !showInput) return
    const el = typeof boundInputRef === 'function' ? null : boundInputRef?.current
    el?.focus()
  }, [autoFocus, boundInputRef, showInput])

  useEffect(() => {
    if (!query.trim()) {
      setDebounced('')
      return
    }
    const timer = window.setTimeout(() => setDebounced(query), 180)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!debounced.trim()) return
    void runKnowledgeSearch(debounced.trim(), { limit: 40 })
  }, [debounced])

  const queryPending = query.trim() !== debounced.trim()
  const searchPendingForDebounced = Boolean(debounced.trim()) && snap.query !== debounced.trim()
  const hits =
    !queryPending && debounced.trim() && query.trim() && snap.query === debounced.trim()
      ? snap.hits
      : []
  const highlightedIndex = hoverIndex >= 0 ? hoverIndex : activeIndex
  const activeOptionId = hits.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
  const showLoading =
    snap.loading || queryPending || (searchPendingForDebounced && !!debounced.trim())
  const showEmpty = debounced.trim() && !showLoading && hits.length === 0

  useEffect(() => {
    setActiveIndex(0)
    setHoverIndex(-1)
  }, [debounced])

  useEffect(() => {
    if (hits.length === 0) return
    setActiveIndex((i) => Math.min(i, hits.length - 1))
  }, [hits.length])

  useEffect(() => {
    if (hits.length === 0) return
    const active = document.getElementById(`${listboxId}-option-${highlightedIndex}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, hits.length, listboxId])

  const openHit = useCallback(
    (hit: SearchHit) => {
      dispatchKnowledgeNavigateHit('search', hit)
      onHitOpened?.()
    },
    [onHitOpened],
  )

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
      if (isComposingKeyEvent(e)) return
      if (hits.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHoverIndex(-1)
        setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
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
        const hit = hits[highlightedIndex]
        if (hit) openHit(hit)
      }
    },
    [highlightedIndex, hits, openHit],
  )

  useEffect(() => {
    if (showInput) return
    const el = externalInputRef?.current
    if (!el) return
    const handler = (e: KeyboardEvent) => onInputKeyDown(e)
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [externalInputRef, onInputKeyDown, showInput])

  useEffect(() => {
    if (showInput) return
    const el = externalInputRef?.current
    if (!el) return
    el.setAttribute('role', 'combobox')
    el.setAttribute('aria-expanded', hits.length > 0 && !showLoading ? 'true' : 'false')
    el.setAttribute('aria-controls', listboxId)
    el.setAttribute('aria-autocomplete', 'list')
    if (hits.length > 0 && activeOptionId) {
      el.setAttribute('aria-activedescendant', activeOptionId)
    } else {
      el.removeAttribute('aria-activedescendant')
    }
    return () => {
      el.removeAttribute('role')
      el.removeAttribute('aria-expanded')
      el.removeAttribute('aria-controls')
      el.removeAttribute('aria-autocomplete')
      el.removeAttribute('aria-activedescendant')
    }
  }, [activeOptionId, externalInputRef, hits.length, listboxId, showInput, showLoading])

  const input = showInput ? (
    <input
      ref={inputRef}
      className="kos-search-input"
      role="combobox"
      aria-expanded={hits.length > 0 && !showLoading}
      aria-controls={listboxId}
      aria-activedescendant={hits.length > 0 ? activeOptionId : undefined}
      aria-autocomplete="list"
      value={query}
      onChange={(e) => {
        const next = e.target.value
        onQueryChange(next)
        if (!next.trim()) setDebounced('')
        setActiveIndex(0)
        setHoverIndex(-1)
      }}
      onKeyDown={onInputKeyDown}
      placeholder={t('knowledge.search.placeholder')}
      aria-label={t('knowledge.search.aria')}
    />
  ) : null

  const hitList = hits.map((hit, idx) => {
    const shared = {
      type: 'button' as const,
      id: `${listboxId}-option-${idx}`,
      role: 'option' as const,
      'aria-selected': idx === highlightedIndex,
      'data-active': idx === highlightedIndex ? ('true' as const) : undefined,
      onMouseEnter: () => setHoverIndex(idx),
      onClick: () => openHit(hit),
    }

    return (
      <li key={hit.docKey} role="presentation">
        <button {...shared} className="kos-link-btn kos-search-hit">
          <strong>{hit.title}</strong>
          {hit.snippet ? <span className="kos-search-snippet">{hit.snippet}</span> : null}
          <span className="kos-search-score">{Math.round(hit.score)}</span>
        </button>
      </li>
    )
  })

  return (
    <div className="kos-search-panel">
      {!showInput ? (
        <p className="kos-search-scope-hint">{t('knowledge.search.scopeHint')}</p>
      ) : null}
      {input}
      {showLoading ? (
        <div className="kos-panel-loading" role="status" aria-live="polite">
          <Icon name="refresh" size="md" tone="muted" className="kos-panel-loading-icon" />
          <p className="kos-panel-muted">{t('knowledge.search.loading')}</p>
        </div>
      ) : null}
      {showEmpty ? <EmptyState variant="compact" icon="search" title={t('knowledge.search.empty')} /> : null}
      {hits.length > 0 ? (
        <ul
          id={listboxId}
          className="kos-virtual-list kos-search-results luna-overlay-scroll"
          role="listbox"
          onMouseLeave={() => setHoverIndex(-1)}
        >
          {hitList}
        </ul>
      ) : null}
    </div>
  )
})
