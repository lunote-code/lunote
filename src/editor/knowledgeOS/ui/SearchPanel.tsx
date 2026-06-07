import { forwardRef, useCallback, useEffect, useId, useState } from 'react'

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
  /** Modal only: scope hint id for aria-describedby */
  scopeHintId?: string
  /** When true, render command-palette-style shell (knowledge search modal). */
  variant?: 'inline' | 'modal'
}

function isComposingKeyEvent(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  return e.nativeEvent.isComposing || e.key === 'Process'
}

export const SearchPanel = forwardRef<HTMLInputElement, Props>(function SearchPanel(
  { query, onQueryChange, autoFocus, onHitOpened, scopeHintId, variant = 'inline' },
  inputRef,
) {
  const { t } = useI18n()
  const snap = useSearchSlice()
  const listboxId = useId()
  const [debounced, setDebounced] = useState(query)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(-1)

  const isModal = variant === 'modal'

  useEffect(() => {
    if (!autoFocus || isModal) return
    const el = typeof inputRef === 'function' ? null : inputRef?.current
    el?.focus()
  }, [autoFocus, inputRef, isModal])

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
  const hits =
    !queryPending && debounced.trim() && query.trim() && snap.query === debounced.trim()
      ? snap.hits
      : []
  const highlightedIndex = hoverIndex >= 0 ? hoverIndex : activeIndex
  const activeOptionId = hits.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
  const showLoading = snap.loading || (queryPending && !!query.trim())
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

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
  }

  const inputClassName = isModal ? 'command-palette-input global-search-input' : 'kos-search-input'

  const input = (
    <input
      ref={inputRef}
      className={inputClassName}
      role="combobox"
      aria-expanded={hits.length > 0 && !showLoading}
      aria-controls={listboxId}
      aria-activedescendant={hits.length > 0 ? activeOptionId : undefined}
      aria-autocomplete="list"
      aria-describedby={isModal ? scopeHintId : undefined}
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
  )

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

    if (isModal) {
      return (
        <li key={hit.docKey} role="presentation">
          <button {...shared} className="command-palette-item">
            <span className="command-palette-item-row">
              <span className="command-palette-item-label">{hit.title}</span>
              <span className="command-palette-item-shortcut">{Math.round(hit.score)}</span>
            </span>
            {hit.snippet ? <span className="command-palette-item-hint kos-search-snippet">{hit.snippet}</span> : null}
          </button>
        </li>
      )
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

  if (isModal) {
    return (
      <>
        <div className="global-search-header">
          {scopeHintId ? (
            <p id={scopeHintId} className="global-search-scope-hint">
              {t('knowledge.search.scopeHint')}
            </p>
          ) : null}
          {input}
        </div>
        <ul
          id={listboxId}
          className="command-palette-list luna-overlay-scroll"
          role="listbox"
          onMouseLeave={() => setHoverIndex(-1)}
        >
          {showLoading ? (
            <li className="command-palette-empty command-palette-loading" role="status" aria-live="polite">
              <Icon name="refresh" size="sm" className="command-palette-loading-icon" tone="muted" />
              <span>{t('knowledge.search.loading')}</span>
            </li>
          ) : showEmpty ? (
            <li className="command-palette-empty-item">
              <EmptyState variant="compact" icon="search" title={t('knowledge.search.empty')} />
            </li>
          ) : (
            hitList
          )}
        </ul>
      </>
    )
  }

  return (
    <div className="kos-search-panel">
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
