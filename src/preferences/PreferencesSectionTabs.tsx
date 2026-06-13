import type { KeyboardEvent, ReactNode } from 'react'
import type { TranslateFn } from '../i18n'
import type { PrefsSectionTabId, PrefsSectionTabsDefinition } from './prefsSectionTabsMeta'

type Props = {
  t: TranslateFn
  definition: PrefsSectionTabsDefinition
  activeTab: PrefsSectionTabId
  onTabChange: (tab: PrefsSectionTabId) => void
  tabSuffixes?: Partial<Record<PrefsSectionTabId, ReactNode>>
  className?: string
}

export function PreferencesSectionTabs({
  t,
  definition,
  activeTab,
  onTabChange,
  tabSuffixes,
  className,
}: Props) {
  const sectionPrefix = `prefs-${definition.prefsTab}`
  const tabsClassName = [
    'prefs-section-tabs',
    definition.tabs.length === 2 ? 'prefs-section-tabs--count-2' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: PrefsSectionTabId) => {
    const currentIndex = definition.tabs.findIndex((tab) => tab.id === tabId)
    if (currentIndex < 0) return
    const focusTab = (index: number) => {
      const next = definition.tabs[index]
      if (!next) return
      onTabChange(next.id)
      document.getElementById(`${sectionPrefix}-tab-${next.id}`)?.focus()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusTab((currentIndex + 1) % definition.tabs.length)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusTab((currentIndex - 1 + definition.tabs.length) % definition.tabs.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(definition.tabs.length - 1)
    }
  }

  return (
    <div
      className={tabsClassName}
      role="tablist"
      aria-label={t(definition.tabsAriaLabelKey)}
      aria-orientation="horizontal"
    >
      {definition.tabs.map((tab) => {
        const active = tab.id === activeTab
        const suffix = tabSuffixes?.[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${sectionPrefix}-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`${sectionPrefix}-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className={`prefs-section-tab${active ? ' is-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, tab.id)}
          >
            {t(tab.labelKey)}
            {suffix}
          </button>
        )
      })}
    </div>
  )
}
