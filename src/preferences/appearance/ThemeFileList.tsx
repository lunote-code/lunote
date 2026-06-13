import { useEffect, useMemo, useState } from 'react'
import type { TranslateFn } from '../../i18n'
import { SettingsInput, SettingsSwitch } from '../../components/settings'
import { PreferencesSectionTabs } from '../PreferencesSectionTabs'
import {
  readStoredPrefsSectionTab,
  THEME_FILE_FILTER_TABS,
  writeStoredPrefsSectionTab,
  type PrefsSectionTabId,
} from '../prefsSectionTabsMeta'

export type ThemeFileListEntry = {
  name: string
}

type Props = {
  t: TranslateFn
  listId: string
  listAriaLabel: string
  entries: readonly ThemeFileListEntry[]
  activeNames: ReadonlySet<string>
  enableLabelKey: string
  disableLabelKey: string
  onToggle: (name: string) => void
}

const MAX_VISIBLE_ROWS = 200

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function ThemeFileList({
  t,
  listId,
  listAriaLabel,
  entries,
  activeNames,
  enableLabelKey,
  disableLabelKey,
  onToggle,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<PrefsSectionTabId>(() =>
    readStoredPrefsSectionTab(THEME_FILE_FILTER_TABS),
  )

  useEffect(() => {
    writeStoredPrefsSectionTab(THEME_FILE_FILTER_TABS, filterMode)
  }, [filterMode])

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
  const filterPanelId = `${listId}-filter-panel`

  return (
    <div className="prefs-theme-extension-content">
      <div className="prefs-theme-file-toolbar">
        <SettingsInput
          type="search"
          className="prefs-theme-file-search"
          value={searchQuery}
          placeholder={t('settings.theme.fileList.searchPlaceholder')}
          aria-controls={listId}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <PreferencesSectionTabs
          t={t}
          definition={THEME_FILE_FILTER_TABS}
          activeTab={filterMode}
          className="prefs-theme-file-filter-tabs"
          onTabChange={setFilterMode}
        />
      </div>

      <p className="prefs-theme-file-summary">
        {t('settings.theme.fileList.showingCount', {
          shown: String(visibleEntries.length),
          total: String(filteredEntries.length),
        })}
      </p>

      <div
        id={filterPanelId}
        role="region"
        aria-labelledby={`prefs-appearance-tab-${filterMode}`}
      >
        {visibleEntries.length > 0 ? (
          <div className="prefs-theme-file-scroll">
            <ul id={listId} className="prefs-theme-file-list" aria-label={listAriaLabel}>
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
                      onCheckedChange={() => onToggle(entry.name)}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p className="prefs-theme-extension-empty">{t('settings.theme.fileList.noResults')}</p>
        )}
      </div>

      {hiddenCount > 0 ? (
        <p className="prefs-theme-file-truncated">
          {t('settings.theme.fileList.truncatedHint', { count: String(hiddenCount) })}
        </p>
      ) : null}
    </div>
  )
}
