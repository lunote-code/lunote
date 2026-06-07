import type { KeyboardEvent, ReactNode } from 'react'
import { Icon, type SemanticIconName } from '../../design-system/icons'

export type SettingsSidebarItem<T extends string> = {
  id: T
  label: ReactNode
  icon?: SemanticIconName
}

export type SettingsSidebarGroup<T extends string> = {
  label?: ReactNode
  items: readonly SettingsSidebarItem<T>[]
}

type SettingsSidebarProps<T extends string> = {
  ariaLabel: string
  groups: readonly SettingsSidebarGroup<T>[]
  activeItem: T
  onItemChange: (item: T) => void
  search?: ReactNode
}

export function SettingsSidebar<T extends string>({
  ariaLabel,
  groups,
  activeItem,
  onItemChange,
  search,
}: SettingsSidebarProps<T>) {
  const flatItems = groups.flatMap((group) => group.items)

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemId: T) => {
    const currentIndex = flatItems.findIndex((item) => item.id === itemId)
    if (currentIndex < 0) return
    const focusItem = (index: number) => {
      const next = flatItems[index]
      if (!next) return
      onItemChange(next.id)
      document.getElementById(`prefs-tab-${next.id}`)?.focus()
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusItem((currentIndex + 1) % flatItems.length)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusItem((currentIndex - 1 + flatItems.length) % flatItems.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(flatItems.length - 1)
    }
  }

  return (
    <aside className="settings-sidebar" aria-label={ariaLabel}>
      {search ? <div className="settings-sidebar-search">{search}</div> : null}
      <nav className="settings-sidebar-nav" role="tablist" aria-orientation="vertical">
        {groups.map((group, groupIndex) => (
          <div className="settings-sidebar-group" key={groupIndex}>
            {group.label ? <div className="settings-sidebar-group-label">{group.label}</div> : null}
            <div className="settings-sidebar-group-items">
              {group.items.map((item) => {
                const active = item.id === activeItem
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`prefs-tab-${item.id}`}
                    aria-selected={active}
                    aria-controls={`prefs-panel-${item.id}`}
                    tabIndex={active ? 0 : -1}
                    className={`settings-sidebar-item${active ? ' is-active' : ''}`}
                    onClick={() => onItemChange(item.id)}
                    onKeyDown={(event) => onTabKeyDown(event, item.id)}
                  >
                    {item.icon ? <Icon name={item.icon} className="settings-sidebar-item-icon" size="md" tone={active ? 'accent' : 'muted'} /> : null}
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
