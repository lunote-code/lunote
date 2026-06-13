import { useEffect, useRef } from 'react'

import { Icon } from '../../../design-system/icons/Icon'
import { useI18n } from '../../../i18n'

type Props = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onRequestClose: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function KnowledgeRailHeaderSearchBar({
  searchQuery,
  onSearchQueryChange,
  onRequestClose,
  inputRef: externalInputRef,
}: Props) {
  const { t } = useI18n()
  const localInputRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? localInputRef
  const showClear = Boolean(searchQuery.trim())

  const closeSearch = () => {
    onSearchQueryChange('')
    onRequestClose()
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  return (
    <div className="sidebar-header-search-bar" data-testid="kos-rail-header-search-bar">
      <button
        type="button"
        className="sidebar-chrome-btn"
        onClick={closeSearch}
        aria-label={t('app.sidebar.search.backAria')}
        title={t('app.sidebar.search.back')}
        data-testid="kos-rail-search-back"
      >
        <Icon name="chevron-left" size="sm" stroke="strong" />
      </button>
      <div className={`sidebar-search-field${showClear ? ' sidebar-search-field--has-clear' : ''}`}>
        <input
          ref={inputRef}
          data-testid="kos-rail-search-input"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            closeSearch()
          }}
          className="search-input sidebar-search-input"
          placeholder={t('knowledge.search.placeholder')}
          aria-label={t('knowledge.search.aria')}
        />
        {showClear ? (
          <button
            type="button"
            className="sidebar-search-clear icon-btn ghost-btn"
            onClick={() => onSearchQueryChange('')}
            aria-label={t('app.sidebar.search.clear')}
            title={t('app.sidebar.search.clear')}
          >
            <Icon name="close" size="sm" tone="muted" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
