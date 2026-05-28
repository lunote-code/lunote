import { useEffect, useRef, useState } from 'react'
import { runKnowledgeSearch } from '../knowledgeSearchRuntime'
import { useSearchSlice } from './useKnowledgeOSSlice'
import { dispatchKnowledgeNavigateHit } from './interactionTransaction'
import { useI18n } from '../../../i18n'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  autoFocus?: boolean
  onHitOpened?: () => void
}

export function SearchPanel({ query, onQueryChange, autoFocus, onHitOpened }: Props) {
  const { t } = useI18n()
  const snap = useSearchSlice()
  const inputRef = useRef<HTMLInputElement>(null)
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 180)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!debounced.trim()) return
    void runKnowledgeSearch(debounced.trim(), { limit: 40 })
  }, [debounced])

  const hits = debounced.trim() ? snap.hits : []

  return (
    <div className="kos-search-panel">
      <input
        ref={inputRef}
        className="kos-search-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('knowledge.search.placeholder')}
        aria-label={t('knowledge.search.aria')}
      />
      {snap.loading && <p className="kos-panel-muted">{t('knowledge.search.loading')}</p>}
      <ul className="kos-virtual-list kos-search-results">
        {hits.length === 0 && debounced.trim() && !snap.loading ? (
          <li className="kos-panel-muted">{t('knowledge.search.empty')}</li>
        ) : (
          hits.map((hit) => (
            <li key={hit.docKey}>
              <button
                type="button"
                className="kos-link-btn kos-search-hit"
                onClick={() => {
                  dispatchKnowledgeNavigateHit('search', hit)
                  onHitOpened?.()
                }}
              >
                <strong>{hit.title}</strong>
                {hit.snippet ? <span className="kos-search-snippet">{hit.snippet}</span> : null}
                <span className="kos-search-score">{Math.round(hit.score)}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
