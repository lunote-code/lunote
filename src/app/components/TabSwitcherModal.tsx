import { useMemo, type RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { formatCommandShortcutDisplay } from '../../menu'
import { buildTabSwitcherCandidates } from '../document/tabMru'
import {
  WorkspaceOverlayPickerModal,
  type WorkspaceOverlayPickerRow,
} from './WorkspaceOverlayPickerModal'

export type TabSwitcherModalProps = {
  open: boolean
  query: string
  openedTabs: readonly string[]
  mruPaths: readonly string[]
  tabLabel: (path: string) => string
  onQueryChange: (query: string) => void
  onClose: () => void
  onActivateTab: (path: string) => void | Promise<void>
  inputRef?: RefObject<HTMLInputElement | null>
  t: TranslateFn
}

export function TabSwitcherModal(props: TabSwitcherModalProps) {
  const {
    open,
    query,
    openedTabs,
    mruPaths,
    tabLabel,
    onQueryChange,
    onClose,
    onActivateTab,
    inputRef,
    t,
  } = props

  const placeholder = useMemo(
    () =>
      t('app.tabSwitcher.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-tab-switcher'),
      }),
    [t],
  )

  const visibleResults = useMemo(() => {
    if (!open) return []
    return buildTabSwitcherCandidates(query, openedTabs, mruPaths, tabLabel)
  }, [mruPaths, open, openedTabs, query, tabLabel])

  const rows = useMemo((): WorkspaceOverlayPickerRow[] => {
    return visibleResults.map((item) => ({
      key: item.path,
      label: item.label,
    }))
  }, [visibleResults])

  const listState =
    query.trim().length > 0 && rows.length === 0 ? ('empty' as const) : ('results' as const)

  return (
    <WorkspaceOverlayPickerModal
      open={open}
      query={query}
      onQueryChange={onQueryChange}
      onClose={onClose}
      onActivate={(path) => {
        void onActivateTab(path)
      }}
      rows={rows}
      listState={listState}
      inputRef={inputRef}
      ariaLabel={t('app.tabSwitcher.aria')}
      scopeHint={t('app.tabSwitcher.scopeHint', { count: openedTabs.length })}
      placeholder={placeholder}
      testId="tab-switcher-modal"
      modalClassName="tab-switcher-modal global-search-modal"
      loadingLabel={t('app.globalSearch.searching')}
      emptyTitle={t('app.tabSwitcher.empty')}
    />
  )
}
