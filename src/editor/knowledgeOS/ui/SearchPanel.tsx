import { forwardRef, useCallback, useEffect, useId, useMemo, useState, type RefObject } from 'react'

import { EmptyState } from '../../../design-system/EmptyState'
import { Icon } from '../../../design-system/icons'
import { getBacklinksForDoc, getDocumentMeta } from '../../knowledgeRuntime'
import type { SearchHit } from '../../knowledgeRuntime/types'
import { runKnowledgeSearch } from '../knowledgeSearchRuntime'
import { useSearchSlice } from './useKnowledgeOSSlice'
import { dispatchKnowledgeNavigateHit } from './interactionTransaction'
import { useI18n } from '../../../i18n'
import { getKnowledgeInteractionHost } from './knowledgeInteractionHost'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  autoFocus?: boolean
  onHitOpened?: () => void
  onTagNavigate?: (tag: string) => void
  onOpenGraph?: () => void
  /** When false, input is rendered in the rail/sidebar header; bind keyboard via externalInputRef. */
  showInput?: boolean
  externalInputRef?: RefObject<HTMLInputElement | null>
}

type SearchGroupKey = SearchHit['matchKind']

const SEARCH_GROUP_ORDER: SearchGroupKey[] = ['title', 'content', 'tag', 'backlink']

function groupHits(hits: SearchHit[]): Array<{ kind: SearchGroupKey; hits: SearchHit[] }> {
  const grouped = new Map<SearchGroupKey, SearchHit[]>()
  for (const hit of hits) {
    const group = grouped.get(hit.matchKind) ?? []
    group.push(hit)
    grouped.set(hit.matchKind, group)
  }
  return SEARCH_GROUP_ORDER
    .map((kind) => {
      const groupHitsForKind = grouped.get(kind) ?? []
      return groupHitsForKind.length > 0 ? { kind, hits: groupHitsForKind } : null
    })
    .filter(Boolean) as Array<{ kind: SearchGroupKey; hits: SearchHit[] }>
}

function isComposingKeyEvent(e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>): boolean {
  return ('nativeEvent' in e && e.nativeEvent.isComposing) || e.key === 'Process'
}

export const SearchPanel = forwardRef<HTMLInputElement, Props>(function SearchPanel(
  { query, onQueryChange, autoFocus, onHitOpened, onTagNavigate, onOpenGraph, showInput = true, externalInputRef },
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
  const groupedHits = useMemo(() => groupHits(hits), [hits])
  const canInsertWikiLink = Boolean(getKnowledgeInteractionHost()?.insertWikiLinkAtCursor)
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

  const insertWikiLink = useCallback(
    (hit: SearchHit) => {
      const inserted = getKnowledgeInteractionHost()?.insertWikiLinkAtCursor?.({
        docKey: hit.docKey,
        title: hit.title,
      })
      if (inserted) onHitOpened?.()
    },
    [onHitOpened],
  )

  const openHitGraph = useCallback(
    (hit: SearchHit) => {
      dispatchKnowledgeNavigateHit('search', hit)
      onOpenGraph?.()
      onHitOpened?.()
    },
    [onHitOpened, onOpenGraph],
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

  let globalHitIndex = -1
  const hitList = groupedHits.map((group) => {
    const groupLabel =
      group.kind === 'title'
        ? t('knowledge.search.group.title')
        : group.kind === 'content'
          ? t('knowledge.search.group.content')
          : group.kind === 'tag'
            ? t('knowledge.search.group.tag')
            : t('knowledge.search.group.backlink')

    return (
      <li key={group.kind} className="kos-search-group" role="presentation">
        <div className="kos-search-group-heading">
          <span>{groupLabel}</span>
          <span className="kos-panel-muted">{group.hits.length}</span>
        </div>
        <ul className="kos-search-group-list" role="presentation">
          {group.hits.map((hit) => {
            globalHitIndex += 1
            const idx = globalHitIndex
            const meta = getDocumentMeta(hit.docKey)
            const tags = meta?.outboundTags?.slice(0, 4) ?? []
            const hiddenTagCount = Math.max(0, (meta?.outboundTags?.length ?? 0) - tags.length)
            const backlinkCount = getBacklinksForDoc(hit.docKey).length
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
              <li key={`${group.kind}-${hit.docKey}`} role="presentation">
                <div className="kos-search-hit-card">
                  <button {...shared} className="kos-link-btn kos-search-hit">
                    <strong>{hit.title}</strong>
                    {hit.snippet ? <span className="kos-search-snippet">{hit.snippet}</span> : null}
                    <span className="kos-search-hit-meta">
                      <span className="kos-search-hit-backlinks">
                        {t('knowledge.search.result.backlinks', { count: backlinkCount })}
                      </span>
                    </span>
                  </button>
                  {tags.length > 0 ? (
                    <div className="kos-search-hit-tags">
                      {tags.map((tag) => (
                        <button
                          key={`${hit.docKey}-${tag}`}
                          type="button"
                          className="kos-search-hit-tag"
                          onClick={() => onTagNavigate?.(tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                      {hiddenTagCount > 0 ? (
                        <span className="kos-panel-muted">
                          {t('knowledge.search.result.moreTags', { count: hiddenTagCount })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="kos-search-hit-actions">
                    <button
                      type="button"
                      className="kos-search-hit-action"
                      disabled={!canInsertWikiLink}
                      onClick={() => insertWikiLink(hit)}
                    >
                      {t('knowledge.search.action.insertLink')}
                    </button>
                    <button
                      type="button"
                      className="kos-search-hit-action"
                      onClick={() => openHitGraph(hit)}
                    >
                      {t('knowledge.search.action.openGraph')}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
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
