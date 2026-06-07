import { useEffect, useId, useRef } from 'react'

import { isWikiSuggestItemSelectable } from './lunaWikiLinkSuggest'
import type { SlashMenuState, WikiLinkMenuState } from './tiptapSlashMenuModel'

type WikiLinkSuggestMenuProps = {
  menu: WikiLinkMenuState
  ariaLabel: string
  onApply: (index: number) => void
}

export function WikiLinkSuggestMenu({
  menu,
  ariaLabel,
  onApply,
}: WikiLinkSuggestMenuProps) {
  const listboxId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const activeOptionId =
    menu.items.length > 0 ? `${listboxId}-option-${menu.activeIndex}` : undefined

  useEffect(() => {
    if (!activeOptionId) return
    const active = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(activeOptionId)}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeOptionId, menu.activeIndex, menu.items.length])

  return (
    <div
      ref={listRef}
      className={`editor-slash-menu-host pm-slash-menu luna-wiki-suggest-menu${
        menu.placement === 'above' ? ' pm-slash-menu--above' : ''
      }`}
      style={{
        left: menu.left,
        top: menu.top,
        ...(menu.maxHeight ? { maxHeight: menu.maxHeight, overflowY: 'auto' as const } : {}),
      }}
      role="listbox"
      id={listboxId}
      aria-label={ariaLabel}
      aria-activedescendant={activeOptionId}
    >
      {menu.items.map((item, idx) => {
        const active = idx === menu.activeIndex
        const selectable = isWikiSuggestItemSelectable(item)
        return (
          <button
            key={item.id}
            id={`${listboxId}-option-${idx}`}
            type="button"
            role="option"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={!selectable}
            className={`pm-slash-item luna-wiki-suggest-item${active ? ' active' : ''}${
              !selectable ? ' luna-wiki-suggest-item--disabled' : ''
            }`}
            onMouseDown={(event) => {
              event.preventDefault()
              if (!selectable) return
              onApply(idx)
            }}
          >
            <span className="luna-wiki-suggest-item__title">{item.title}</span>
            <span className="luna-wiki-suggest-item__hint">{item.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

type SlashCommandMenuProps = {
  menu: SlashMenuState
  ariaLabel: string
  hoverIndex: number
  onHoverIndexChange: (index: number) => void
  onApply: (index: number) => void
  onCaptureSelection: () => void
}

export function SlashCommandMenu({
  menu,
  ariaLabel,
  hoverIndex,
  onHoverIndexChange,
  onApply,
  onCaptureSelection,
}: SlashCommandMenuProps) {
  const listboxId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const activeIndex = hoverIndex >= 0 ? hoverIndex : menu.activeIndex
  const activeOptionId =
    menu.rows.length > 0 && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

  useEffect(() => {
    if (!activeOptionId) return
    const active = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(activeOptionId)}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeOptionId, activeIndex, menu.rows.length])

  return (
    <div
      ref={listRef}
      className={`editor-slash-menu-host pm-slash-menu${
        menu.placement === 'above' ? ' pm-slash-menu--above' : ''
      }`}
      style={{
        left: menu.left,
        top: menu.top,
        ...(menu.maxHeight ? { maxHeight: menu.maxHeight, overflowY: 'auto' as const } : {}),
      }}
      role="listbox"
      id={listboxId}
      aria-label={ariaLabel}
      aria-activedescendant={activeOptionId}
      onMouseLeave={() => onHoverIndexChange(-1)}
    >
      {menu.rows.map((row, idx) => {
        const active = hoverIndex >= 0 ? idx === hoverIndex : idx === menu.activeIndex
        const nested = row.depth > 0
        const groupHeader = !row.executable
        return (
          <button
            key={row.id}
            id={`${listboxId}-option-${idx}`}
            type="button"
            role="option"
            aria-selected={active}
            aria-disabled={groupHeader || undefined}
            tabIndex={active && !groupHeader ? 0 : -1}
            disabled={groupHeader}
            className={`pm-slash-item${nested ? ' pm-slash-item--nested' : ''}${
              groupHeader ? ' pm-slash-item--group' : ''
            }${active ? ' active' : ''}`}
            onMouseDown={(event) => {
              if (groupHeader || !row.run) return
              event.preventDefault()
              onCaptureSelection()
              onApply(idx)
            }}
            onMouseEnter={() => {
              if (groupHeader) return
              onHoverIndexChange(idx)
            }}
          >
            {row.label}
          </button>
        )
      })}
    </div>
  )
}
