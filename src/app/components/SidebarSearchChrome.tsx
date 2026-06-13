import { useEffect, useRef } from 'react'
import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons/Icon'
import { formatCommandShortcutDisplay } from '../../menu'

type SearchFieldProps = {
  t: TranslateFn
  rootDir: string
  searchText: string
  onSearchTextChange: (value: string) => void
  onRequestClose: () => void
}

type ToggleProps = {
  t: TranslateFn
  rootDir: string
  open: boolean
  isFiltering: boolean
  onToggle: () => void
}

export function SidebarSearchToggleButton({ t, rootDir, open, isFiltering, onToggle }: ToggleProps) {
  const hasWorkspace = Boolean(rootDir.trim())

  return (
    <button
      type="button"
      className={`sidebar-chrome-btn${open || isFiltering ? ' sidebar-chrome-btn--active' : ''}`}
      onClick={onToggle}
      disabled={!hasWorkspace}
      aria-pressed={open}
      aria-label={t('app.sidebar.search.toggleAria')}
      title={t('app.sidebar.search.toggle')}
      data-testid="sidebar-search-toggle"
    >
      <Icon name="search" size="sm" />
    </button>
  )
}

export function SidebarHeaderSearchBar({
  t,
  rootDir,
  searchText,
  onSearchTextChange,
  onRequestClose,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasWorkspace = Boolean(rootDir.trim())
  const filterPlaceholder = hasWorkspace
    ? t('app.sidebar.search.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-search'),
      })
    : t('app.sidebar.search.placeholderNeedWorkspace')
  const showClear = hasWorkspace && Boolean(searchText.trim())

  const closeSearch = () => {
    onSearchTextChange('')
    onRequestClose()
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="sidebar-header-search-bar" data-testid="sidebar-header-search-bar">
      <button
        type="button"
        className="sidebar-chrome-btn"
        onClick={closeSearch}
        aria-label={t('app.sidebar.search.backAria')}
        title={t('app.sidebar.search.back')}
        data-testid="sidebar-search-back"
      >
        <Icon name="chevron-left" size="sm" stroke="strong" />
      </button>
      <div className={`sidebar-search-field${showClear ? ' sidebar-search-field--has-clear' : ''}`}>
        <input
          ref={inputRef}
          id="search-input"
          data-testid="sidebar-search-input"
          value={searchText}
          disabled={!hasWorkspace}
          onChange={(e) => onSearchTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            closeSearch()
          }}
          className="search-input sidebar-search-input"
          placeholder={filterPlaceholder}
          aria-label={t('app.sidebar.search.aria')}
        />
        {showClear ? (
          <button
            type="button"
            className="sidebar-search-clear icon-btn ghost-btn"
            onClick={() => onSearchTextChange('')}
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
