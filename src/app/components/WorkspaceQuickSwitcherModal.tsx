import { useMemo, type RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { formatCommandShortcutDisplay } from '../../menu'
import {
  runWorkspaceQuickSwitcherSearch,
  type WorkspaceSearchIndexEntry,
} from '../search/workspaceSearch'
import {
  WorkspaceOverlayPickerModal,
  type WorkspaceOverlayPickerRow,
} from './WorkspaceOverlayPickerModal'

export type WorkspaceQuickSwitcherModalProps = {
  open: boolean
  query: string
  rootDir: string
  searchIndex: readonly WorkspaceSearchIndexEntry[]
  recentPaths: readonly string[]
  onQueryChange: (query: string) => void
  onClose: () => void
  onOpenDocument: (root: string, path: string) => void | Promise<void>
  inputRef?: RefObject<HTMLInputElement | null>
  t: TranslateFn
}

export function WorkspaceQuickSwitcherModal(props: WorkspaceQuickSwitcherModalProps) {
  const {
    open,
    query,
    rootDir,
    searchIndex,
    recentPaths,
    onQueryChange,
    onClose,
    onOpenDocument,
    inputRef,
    t,
  } = props

  const placeholder = useMemo(
    () =>
      t('app.quickSwitcher.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-quick-switcher'),
      }),
    [t],
  )

  const footerHint = useMemo(
    () =>
      t('app.quickSwitcher.globalSearchHint', {
        shortcut: formatCommandShortcutDisplay('view-search'),
      }),
    [t],
  )

  const visibleResults = useMemo(() => {
    if (!open || !rootDir.trim()) return []
    return runWorkspaceQuickSwitcherSearch(query, searchIndex, recentPaths, 30)
  }, [open, query, recentPaths, rootDir, searchIndex])

  const rows = useMemo((): WorkspaceOverlayPickerRow[] => {
    return visibleResults.map((item) => ({
      key: item.path,
      label: item.title,
      hint: item.snippet,
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
        if (!rootDir.trim()) return
        void onOpenDocument(rootDir, path)
      }}
      rows={rows}
      listState={listState}
      inputRef={inputRef}
      ariaLabel={t('app.quickSwitcher.aria')}
      scopeHint={t('app.quickSwitcher.scopeHint')}
      footerHint={footerHint}
      placeholder={placeholder}
      testId="quick-switcher-modal"
      modalClassName="quick-switcher-modal global-search-modal"
      loadingLabel={t('app.globalSearch.searching')}
      emptyTitle={t('app.quickSwitcher.empty')}
    />
  )
}
