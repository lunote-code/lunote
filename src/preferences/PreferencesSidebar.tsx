import type { RefObject } from 'react'
import type { TranslateFn } from '../i18n'
import { SettingsInput, SettingsSidebar, type SettingsSidebarGroup } from '../components/settings'
import { Icon } from '../design-system/icons'
import { PREFS_TAB_TITLE_KEY } from './prefsMeta'
import type { PrefsTabId } from './types'

type Props = {
  t: TranslateFn
  activeTab: PrefsTabId
  onTabChange: (tab: PrefsTabId) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  visibleTabs: readonly PrefsTabId[]
  searchInputRef?: RefObject<HTMLInputElement | null>
}

const SIDEBAR_GROUPS: readonly SettingsSidebarGroup<PrefsTabId>[] = [
  {
    label: 'settings.sidebar.group.general',
    items: [
      { id: 'general', label: '', icon: 'settings' },
      { id: 'appearance', label: '', icon: 'appearance' },
      { id: 'export', label: '', icon: 'export' },
      { id: 'import', label: '', icon: 'import' },
      { id: 'templates', label: '', icon: 'note-new' },
      { id: 'editor', label: '', icon: 'editor' },
    ],
  },
  {
    label: 'settings.sidebar.group.advanced',
    items: [
      { id: 'shortcuts', label: '', icon: 'shortcuts' },
      { id: 'plugins', label: '', icon: 'plugins' },
      { id: 'language', label: '', icon: 'language' },
    ],
  },
]

export function PreferencesSidebar({
  t,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  visibleTabs,
  searchInputRef,
}: Props) {
  const groups = SIDEBAR_GROUPS.map((group) => ({
    ...group,
    label: typeof group.label === 'string' ? t(group.label) : group.label,
    items: group.items
      .filter((item) => visibleTabs.includes(item.id))
      .map((item) => ({
        ...item,
        label: t(PREFS_TAB_TITLE_KEY[item.id]),
      })),
  })).filter((group) => group.items.length > 0)

  return (
    <SettingsSidebar
      ariaLabel={t('prefs.nav.label')}
      activeItem={activeTab}
      onItemChange={onTabChange}
      groups={groups}
      search={
        <div className="prefs-search-wrap">
          <Icon name="search" className="prefs-search-icon" size="md" tone="muted" />
          <SettingsInput
            ref={searchInputRef}
            type="search"
            className="prefs-search-input"
            placeholder={t('prefs.search.placeholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={t('prefs.search.placeholder')}
          />
        </div>
      }
    />
  )
}
