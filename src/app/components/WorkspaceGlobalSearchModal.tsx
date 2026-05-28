import { useEffect, useMemo, useRef, useState } from 'react'

import type { TranslateFn } from '../../i18n'
import { formatAcceleratorForDisplay, getManifestDefaultAccelerator } from '../../menu'
import { runWorkspaceSearch, type WorkspaceSearchIndexEntry } from '../search/workspaceSearch'
import { safeSearchSnippetHtml } from '../search/searchSnippet'
import type { SearchResult } from '../workspace/types'

export type WorkspaceGlobalSearchModalProps = {
  open: boolean
  query: string
  rootDir: string
  searchIndex: readonly WorkspaceSearchIndexEntry[]
  onQueryChange: (query: string) => void
  onClose: () => void
  onOpenDocument: (root: string, path: string) => void | Promise<void>
  t: TranslateFn
}

export function WorkspaceGlobalSearchModal(props: WorkspaceGlobalSearchModalProps) {
  const { open, query, rootDir, searchIndex, onQueryChange, onClose, onOpenDocument, t } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const placeholder = useMemo(
    () =>
      t('app.globalSearch.placeholder', {
        shortcut: formatAcceleratorForDisplay(getManifestDefaultAccelerator('view-search') ?? 'Mod+Shift+f'),
      }),
    [t],
  )

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedQuery(query), 120)
    return () => window.clearTimeout(timer)
  }, [open, query])

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
      setActiveIndex(0)
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open, rootDir, searchIndex])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const hit = results[activeIndex]
        if (hit && rootDir.trim()) {
          void onOpenDocument(rootDir, hit.path)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [activeIndex, onClose, onOpenDocument, open, results, rootDir])

  if (!open) return null

  const showEmpty = debouncedQuery.trim() && !loading && results.length === 0

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="command-palette global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('app.globalSearch.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            setActiveIndex(0)
          }}
          aria-label={t('app.globalSearch.aria')}
        />
        <ul className="command-palette-list">
          {loading ? (
            <li className="command-palette-empty" key="loading">
              {t('app.globalSearch.searching')}
            </li>
          ) : showEmpty ? (
            <li className="command-palette-empty" key="empty">
              {t('app.globalSearch.empty')}
            </li>
          ) : (
            results.map((item, idx) => (
              <li key={item.path}>
                <button
                  type="button"
                  className="command-palette-item"
                  data-active={idx === activeIndex ? 'true' : undefined}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (!rootDir.trim()) return
                    void onOpenDocument(rootDir, item.path)
                    onClose()
                  }}
                >
                  <span className="command-palette-item-row">
                    <span className="command-palette-item-label">{item.title}</span>
                  </span>
                  {item.snippet ? (
                    <span
                      className="command-palette-item-hint global-search-snippet"
                      dangerouslySetInnerHTML={{ __html: safeSearchSnippetHtml(item.snippet) }}
                    />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
