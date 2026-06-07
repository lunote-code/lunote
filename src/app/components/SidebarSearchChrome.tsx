import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons/Icon'
import { formatCommandShortcutDisplay } from '../../menu'

type Props = {
  t: TranslateFn
  rootDir: string
  searchText: string
  onSearchTextChange: (value: string) => void
}

export function SidebarSearchChrome({ t, rootDir, searchText, onSearchTextChange }: Props) {
  const hasWorkspace = Boolean(rootDir.trim())
  const filterPlaceholder = hasWorkspace
    ? t('app.sidebar.search.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-search'),
      })
    : t('app.sidebar.search.placeholderNeedWorkspace')
  const showClear = hasWorkspace && Boolean(searchText.trim())

  return (
    <div className="sidebar-search-chrome">
      <div className="sidebar-chrome-tabs-row">
        <div className={`sidebar-search-field${showClear ? ' sidebar-search-field--has-clear' : ''}`}>
          <Icon name="search" className="sidebar-search-icon" size="sm" tone="muted" aria-hidden />
          <input
            id="search-input"
            value={searchText}
            disabled={!hasWorkspace}
            onChange={(e) => onSearchTextChange(e.target.value)}
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
    </div>
  )
}
