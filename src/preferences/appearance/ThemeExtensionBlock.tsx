import { useMemo, useState } from 'react'
import type { TranslateFn } from '../../i18n'
import { SettingsButton, SettingsInput, SettingsSwitch } from '../../components/settings'
import { SettingsHelpPopover, SettingsInlineHelp } from '../../components/settings/SettingsHelpPopover'

export type ThemeExtensionEntry = {
  name: string
}

type FilterMode = 'all' | 'enabled'

type Props = {
  t: TranslateFn
  scope: 'ui' | 'export'
  titleKey: string
  descriptionKey: string
  statusActiveKey: string
  statusInactiveKey: string
  statusCountParam?: string
  activeCount: number
  entries: readonly ThemeExtensionEntry[]
  activeNames: ReadonlySet<string>
  emptyCatalogKey: string
  openFolderLabelKey: string
  rescanLabelKey: string
  enableLabelKey: string
  disableLabelKey: string
  descriptionAsHelp?: boolean
  onOpenFolder: () => void
  onRescan: () => void
  onToggle: (name: string) => void
}

const MAX_VISIBLE_ROWS = 200

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function ThemeExtensionBlock({
  t,
  scope,
  titleKey,
  descriptionKey,
  statusActiveKey,
  statusInactiveKey,
  statusCountParam = 'count',
  activeCount,
  entries,
  activeNames,
  emptyCatalogKey,
  openFolderLabelKey,
  rescanLabelKey,
  enableLabelKey,
  disableLabelKey,
  descriptionAsHelp = false,
  onOpenFolder,
  onRescan,
  onToggle,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const listId = `prefs-theme-file-list-${scope}`

  const scopeLabel =
    scope === 'ui' ? t('settings.theme.scope.ui') : t('settings.theme.scope.export')

  const blockTitle = t(titleKey)
  const blockDescription = t(descriptionKey)

  const filteredEntries = useMemo(() => {
    const query = normalizeSearchQuery(searchQuery)
    return entries.filter((entry) => {
      if (filterMode === 'enabled' && !activeNames.has(entry.name)) return false
      if (!query) return true
      return entry.name.toLowerCase().includes(query)
    })
  }, [activeNames, entries, filterMode, searchQuery])

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, MAX_VISIBLE_ROWS),
    [filteredEntries],
  )

  const hiddenCount = Math.max(0, filteredEntries.length - visibleEntries.length)
  const hasCatalog = entries.length > 0

  return (
    <div className="prefs-theme-extension prefs-theme-extension-block">
      <div className="prefs-theme-extension-header">
        <div className="prefs-theme-extension-heading">
          <h5 className="prefs-theme-extension-title">
            {descriptionAsHelp ? (
              <SettingsInlineHelp
                label={blockTitle}
                help={<SettingsHelpPopover title={blockTitle} body={blockDescription} />}
              />
            ) : (
              blockTitle
            )}
          </h5>
          <span className={`prefs-theme-scope-badge prefs-theme-scope-badge--${scope}`}>{scopeLabel}</span>
        </div>
        {descriptionAsHelp ? null : (
          <p className="prefs-theme-extension-description">{blockDescription}</p>
        )}
      </div>

      <p className="prefs-theme-extension-status" role="status">
        {activeCount > 0
          ? t(statusActiveKey, { [statusCountParam]: String(activeCount) })
          : t(statusInactiveKey)}
      </p>

      <div className="settings-inline-controls prefs-theme-extension-actions">
        <SettingsButton type="button" variant="secondary" onClick={() => void onOpenFolder()}>
          {t(openFolderLabelKey)}
        </SettingsButton>
        <SettingsButton type="button" variant="secondary" onClick={() => void onRescan()}>
          {t(rescanLabelKey)}
        </SettingsButton>
      </div>

      {hasCatalog ? (
        <>
          <div className="prefs-theme-file-toolbar">
            <SettingsInput
              type="search"
              className="prefs-theme-file-search"
              value={searchQuery}
              placeholder={t('settings.theme.fileList.searchPlaceholder')}
              aria-controls={listId}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="prefs-theme-file-filter" role="tablist" aria-label={t('settings.theme.fileList.filterLabel')}>
              <button
                type="button"
                role="tab"
                className="prefs-theme-file-filter-btn"
                aria-selected={filterMode === 'all'}
                onClick={() => setFilterMode('all')}
              >
                {t('settings.theme.fileList.filterAll')}
              </button>
              <button
                type="button"
                role="tab"
                className="prefs-theme-file-filter-btn"
                aria-selected={filterMode === 'enabled'}
                onClick={() => setFilterMode('enabled')}
              >
                {t('settings.theme.fileList.filterEnabled')}
              </button>
            </div>
          </div>

          <p className="prefs-theme-file-summary">
            {t('settings.theme.fileList.showingCount', {
              shown: String(visibleEntries.length),
              total: String(filteredEntries.length),
            })}
          </p>

          {visibleEntries.length > 0 ? (
            <div className="prefs-theme-file-scroll">
              <ul id={listId} className="prefs-theme-file-list" aria-label={blockTitle}>
                {visibleEntries.map((entry) => {
                  const enabled = activeNames.has(entry.name)
                  return (
                    <li key={entry.name} className="prefs-theme-file-row">
                      <span className="prefs-theme-file-name" title={entry.name}>
                        {entry.name}
                      </span>
                      <SettingsSwitch
                        checked={enabled}
                        ariaLabel={
                          enabled
                            ? t(disableLabelKey, { file: entry.name })
                            : t(enableLabelKey, { file: entry.name })
                        }
                        onCheckedChange={() => void onToggle(entry.name)}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="prefs-theme-extension-empty">{t('settings.theme.fileList.noResults')}</p>
          )}

          {hiddenCount > 0 ? (
            <p className="prefs-theme-file-truncated">
              {t('settings.theme.fileList.truncatedHint', { count: String(hiddenCount) })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="prefs-theme-extension-empty">{t(emptyCatalogKey)}</p>
      )}
    </div>
  )
}
