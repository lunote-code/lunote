import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { formatCommandShortcutDisplay } from '../../menu'
import { runWorkspaceSearch, type WorkspaceSearchIndexEntry } from '../search/workspaceSearch'
import { safeSearchSnippetHtml } from '../search/searchSnippet'
import type { SearchResult } from '../workspace/types'
import {
  WorkspaceOverlayPickerModal,
  type WorkspaceOverlayPickerRow,
} from './WorkspaceOverlayPickerModal'

export type WorkspaceGlobalSearchModalProps = {
  open: boolean
  query: string
  rootDir: string
  searchIndex: readonly WorkspaceSearchIndexEntry[]
  onQueryChange: (query: string) => void
  onClose: () => void
  onOpenDocument: (
    root: string,
    path: string,
    options?: { searchQuery?: string; searchSnippetHtml?: string },
  ) => void | Promise<void>
  inputRef?: RefObject<HTMLInputElement | null>
  t: TranslateFn
}

export function WorkspaceGlobalSearchModal(props: WorkspaceGlobalSearchModalProps) {
  const { open, query, rootDir, searchIndex, onQueryChange, onClose, onOpenDocument, inputRef: inputRefProp, t } =
    props
  const fallbackInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = inputRefProp ?? fallbackInputRef
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const placeholder = useMemo(
    () =>
      t('app.globalSearch.placeholder', {
        shortcut: formatCommandShortcutDisplay('view-search'),
      }),
    [t],
  )

  const footerHint = useMemo(
    () =>
      t('app.globalSearch.quickSwitcherHint', {
        shortcut: formatCommandShortcutDisplay('view-quick-switcher'),
      }),
    [t],
  )

  const queryPending = query.trim() !== debouncedQuery.trim()

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedQuery(query), 120)
    return () => window.clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    const dq = debouncedQuery.trim()
    if (q !== dq) {
      setResults([])
      setLoading(!!q)
    }
  }, [debouncedQuery, open, query])

  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (!q || !rootDir.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const hits = await runWorkspaceSearch(rootDir, debouncedQuery, searchIndex, 30)
      if (cancelled) return
      setResults(hits)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open, rootDir, searchIndex])

  const visibleResults = useMemo(
    () => (queryPending ? [] : results),
    [queryPending, results],
  )
  const rows = useMemo((): WorkspaceOverlayPickerRow[] => {
    const relativePathFor = (path: string): string => {
      const hit = searchIndex.find((entry) => entry.path === path)
      return hit?.relativePath || hit?.sublabel || path
    }
    return visibleResults.map((item) => ({
      key: item.path,
      label: item.title,
      hint: (
        <span className="global-search-hint-stack">
          <span className="global-search-path">{relativePathFor(item.path)}</span>
          {item.snippet ? (
            <span
              className="global-search-snippet"
              dangerouslySetInnerHTML={{ __html: safeSearchSnippetHtml(item.snippet) }}
            />
          ) : null}
        </span>
      ),
    }))
  }, [searchIndex, visibleResults])

  const showLoading = loading || (queryPending && !!query.trim())
  const showEmpty = debouncedQuery.trim() && !showLoading && visibleResults.length === 0
  const listState = showLoading ? 'loading' : showEmpty ? 'empty' : 'results'

  return (
    <WorkspaceOverlayPickerModal
      open={open}
      query={query}
      onQueryChange={onQueryChange}
      onClose={onClose}
      onActivate={(path) => {
        if (!rootDir.trim()) return
        const hit = visibleResults.find((item) => item.path === path)
        void onOpenDocument(rootDir, path, {
          searchQuery: debouncedQuery.trim(),
          searchSnippetHtml: hit?.snippet,
        })
      }}
      rows={rows}
      listState={listState}
      inputRef={inputRef}
      ariaLabel={t('app.globalSearch.aria')}
      scopeHint={t('app.globalSearch.scopeHint')}
      footerHint={footerHint}
      placeholder={placeholder}
      testId="global-search-modal"
      modalClassName="global-search-modal"
      loadingLabel={t('app.globalSearch.searching')}
      emptyTitle={t('app.globalSearch.empty')}
    />
  )
}
