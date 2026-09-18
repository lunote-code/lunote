import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'

import type { TranslateFn } from '../../i18n'
import {
  buildDocumentHistoryDiffRowsForPath,
  documentHistoryContentEquals,
} from '../../documentHistory/historyDiff'
import {
  subscribeDocumentFrontmatter,
} from '../../editor/documentFrontmatterStore'
import { deleteDocumentSnapshot, listDocumentSnapshots, readDocumentSnapshot } from '../../documentHistory/historyRepository'
import { resolveSnapshotEntrySummary } from '../../documentHistory/snapshotEntrySummary'
import type { DocumentHistoryEntry, DocumentHistorySnapshot } from '../../documentHistory/types'
import { getHistoryRestoreState, resumeAutosaveForPath, subscribeHistoryRestoreState } from '../../documentHistory/historyRestoreState'
import { shouldFlushEditorBeforeHistoryDiff } from '../../documentHistory/historyDialogFlushPolicy'
import { subscribeDocumentRuntime } from '../../documentRuntime/documentKernel'
import { resolveLatestDocumentBody } from '../../documentRuntime/documentAuthority'
import { subscribeTabBodies } from '../document/tabBodiesStore'
import { useFocusTrap } from '../../lib/useFocusTrap'
import type { FlushEditorToMemoryOptions } from '../../lib/editorContentSync'
import { logInfo, logWarn } from '../../lib/lunaLogger'
import { markdownToStyledHtmlFragment } from '../../markdownExport'
import { getCurrentThemeMode, subscribeTheme } from '../../theme-runtime/themeRuntime'
import { handleVerticalResizeKeyDown } from '../../lib/verticalResizeKeyboard'
import { beginVerticalSplitDrag } from '../../lib/verticalSplitDrag'
import { useDelayedFeedback } from '../../lib/useDelayedFeedback'
import { bindOverlayScrollbarReveal } from '../overlayScrollbarReveal'
import { SettingsButton } from '../../components/settings'
import { Icon } from '../../design-system/icons/Icon'
import {
  clampHistoryContextMenuPosition,
  DocumentHistoryContextMenu,
  type DocumentHistoryContextMenuState,
} from './DocumentHistoryContextMenu'
import {
  DocumentHistoryListLoadingSkeleton,
  DocumentHistoryPreviewLoadingSkeleton,
} from './DocumentHistoryLoadingSkeleton'

export type DocumentHistoryDialogContext = {
  rootDir: string
  path: string
}

type Props = {
  t: TranslateFn
  open: boolean
  rootDir: string
  path: string
  activePath?: string
  onClose: () => void
  onRestore: (snapshotId: string, context: DocumentHistoryDialogContext) => Promise<void> | void
  onCreateSnapshot: (
    context: DocumentHistoryDialogContext,
  ) => Promise<DocumentHistoryEntry | null> | DocumentHistoryEntry | null
  onConfirmDeleteSnapshot: (entry: DocumentHistoryEntry) => Promise<boolean> | boolean
  onDeleteAllSnapshots: (context: DocumentHistoryDialogContext) => Promise<boolean> | boolean
  flushEditorToMemory?: (options?: FlushEditorToMemoryOptions) => Promise<boolean>
}

const SIDEBAR_WIDTH_MIN = 200
const SIDEBAR_WIDTH_MAX = 420
const SIDEBAR_WIDTH_STEP = 16
const SIDEBAR_WIDTH_STORAGE_KEY = 'documentHistorySidebarWidth'
const SIDEBAR_WIDTH_DEFAULT = 236
const DIFF_ROW_LIMIT = 240
const HISTORY_LOADING_FEEDBACK_DELAY_MS = 250

function emitHistoryDialogDebug(
  level: 'info' | 'warn',
  event: string,
  payload: Record<string, unknown>,
): void {
  const line = `[history-dialog] ${event}`
  if (level === 'warn') {
    console.warn(line, payload)
    logWarn(line, payload)
    return
  }
  console.info(line, payload)
  logInfo(line, payload)
}

function formatEntryLabel(value: number): string {
  const date = new Date(value)
  const now = new Date()
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function formatHistoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || path
}

function sourceLabel(t: TranslateFn, entry: DocumentHistoryEntry): string {
  if (entry.source === 'pre_restore') return t('app.history.source.preRestore')
  return t('app.history.source.manual')
}

function readStoredSidebarWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_WIDTH_DEFAULT
  const saved = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
  const parsed = saved ? Number(saved) : SIDEBAR_WIDTH_DEFAULT
  if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, parsed))
}

export function DocumentHistoryDialog({
  t,
  open,
  rootDir,
  path,
  activePath,
  onClose,
  onRestore,
  onCreateSnapshot,
  onConfirmDeleteSnapshot,
  onDeleteAllSnapshots,
  flushEditorToMemory,
}: Props) {
  const dialogContext = { rootDir, path }
  const [listLoadError, setListLoadError] = useState(false)
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [preview, setPreview] = useState<DocumentHistorySnapshot | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth)
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('preview')
  const previewTabId = useId()
  const diffTabId = useId()
  const previewPanelId = useId()
  const shouldTrackSelectedSnapshot = open && Boolean(selectedId)
  const shouldTrackDiffBody = shouldTrackSelectedSnapshot && viewMode === 'diff'
  const currentRestoredSnapshotId = useSyncExternalStore(
    subscribeHistoryRestoreState,
    () => getHistoryRestoreState(path)?.snapshotId ?? '',
    () => '',
  )
  const [contextMenu, setContextMenu] = useState<DocumentHistoryContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const historyListRef = useRef<HTMLDivElement | null>(null)
  const historyPreviewBodyRef = useRef<HTMLDivElement | null>(null)
  const flushEditorToMemoryRef = useRef(flushEditorToMemory)
  flushEditorToMemoryRef.current = flushEditorToMemory
  const diffFlushKeyRef = useRef('')
  const contextRestoreId = contextMenu?.target === 'entry' && contextMenu.entryId
    ? contextMenu.entryId
    : selectedId
  const contextRestoreDisabled = !contextRestoreId || contextRestoreId === currentRestoredSnapshotId
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null
  const currentBody = useSyncExternalStore(
    shouldTrackDiffBody
      ? (onStoreChange) => {
          const unsubRuntime = subscribeDocumentRuntime(onStoreChange)
          const unsubTabBodies = subscribeTabBodies(onStoreChange)
          const unsubFrontmatter = subscribeDocumentFrontmatter(onStoreChange)
          return () => {
            unsubRuntime()
            unsubTabBodies()
            unsubFrontmatter()
          }
        }
      : () => () => {},
    shouldTrackDiffBody ? () => resolveLatestDocumentBody(path) ?? '' : () => '',
    () => '',
  )
  const previewDark = useSyncExternalStore(
    shouldTrackSelectedSnapshot ? subscribeTheme : () => () => {},
    shouldTrackSelectedSnapshot ? getCurrentThemeMode : () => 'dark',
    () => 'dark',
  ) === 'dark'
  const diffRows = useMemo(() => {
    if (!preview || viewMode !== 'diff') return []
    return buildDocumentHistoryDiffRowsForPath(path, currentBody, preview.content).slice(0, DIFF_ROW_LIMIT)
  }, [currentBody, path, preview, viewMode])
  const diffHasChanges = useMemo(() => {
    if (!preview || viewMode !== 'diff') return false
    return !documentHistoryContentEquals(path, currentBody, preview.content)
  }, [currentBody, path, preview, viewMode])
  const showListLoadingFeedback = useDelayedFeedback(loading, HISTORY_LOADING_FEEDBACK_DELAY_MS)
  const showPreviewLoadingFeedback = useDelayedFeedback(previewLoading, HISTORY_LOADING_FEEDBACK_DELAY_MS)

  useFocusTrap(open, dialogRef.current, {
    onEscape: () => {
      if (contextMenu) {
        setContextMenu(null)
        return
      }
      onClose()
    },
  })

  async function reloadEntries(preferredId?: string): Promise<void> {
    setListLoadError(false)
    try {
      const next = await listDocumentSnapshots({ rootDir, path })
      setEntries(next)
      setSelectedId((prev) => {
        if (preferredId && next.some((entry) => entry.id === preferredId)) return preferredId
        if (next.some((entry) => entry.id === prev)) return prev
        return next[0]?.id || ''
      })
    } catch (error) {
      setListLoadError(true)
      setEntries([])
      setSelectedId('')
      emitHistoryDialogDebug('warn', 'snapshots_list_failed', {
        path,
        rootDir,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  useEffect(() => {
    if (!open) return
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
  }, [open, sidebarWidth])

  useEffect(() => {
    if (!open || !rootDir || !path) return
    let cancelled = false
    const startedAt = performance.now()
    setLoading(true)
    setListLoadError(false)
    emitHistoryDialogDebug('info', 'open', { path })
    emitHistoryDialogDebug('info', 'invoke_list_start', { path, rootDir })
    void listDocumentSnapshots({ rootDir, path })
      .then((next) => {
        if (cancelled) return
        emitHistoryDialogDebug('info', 'invoke_list_resolved', {
          path,
          count: next.length,
          elapsedMs: Math.round(performance.now() - startedAt),
        })
        setListLoadError(false)
        setEntries(next)
        setSelectedId((prev) => next.some((entry) => entry.id === prev) ? prev : (next[0]?.id || ''))
        emitHistoryDialogDebug('info', 'state_update_queued', {
          path,
          count: next.length,
        })
        queueMicrotask(() => {
          emitHistoryDialogDebug('info', 'post_list_microtask', { path })
        })
        requestAnimationFrame(() => {
          emitHistoryDialogDebug('info', 'post_list_raf', { path })
        })
        const elapsedMs = Math.round(performance.now() - startedAt)
        const payload = { path, count: next.length, elapsedMs }
        if (elapsedMs >= 250) emitHistoryDialogDebug('warn', 'snapshots_list_slow', payload)
        else emitHistoryDialogDebug('info', 'snapshots_list_ready', payload)
      })
      .catch((error) => {
        if (cancelled) return
        setListLoadError(true)
        setEntries([])
        setSelectedId('')
        emitHistoryDialogDebug('warn', 'snapshots_list_failed', {
          path,
          rootDir,
          elapsedMs: Math.round(performance.now() - startedAt),
          message: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, rootDir, path])

  useEffect(() => {
    if (!open || !rootDir || !selectedId) {
      setPreview(null)
      setPreviewHtml('')
      return
    }
    let cancelled = false
    const startedAt = performance.now()
    setPreviewLoading(true)
    void (async () => {
      const snapshot = await readDocumentSnapshot({ rootDir, path, snapshotId: selectedId })
      if (cancelled) return
      setPreview(snapshot)
      try {
        const html = await markdownToStyledHtmlFragment(snapshot.content, {
          dark: previewDark,
          useAppTheme: true,
        })
        if (!cancelled) setPreviewHtml(html)
      } catch {
        if (!cancelled) setPreviewHtml('')
      }
    })().finally(() => {
      if (!cancelled) {
        const elapsedMs = Math.round(performance.now() - startedAt)
        const payload = { path, snapshotId: selectedId, elapsedMs }
        if (elapsedMs >= 250) emitHistoryDialogDebug('warn', 'preview_load_slow', payload)
        else emitHistoryDialogDebug('info', 'preview_ready', payload)
        setPreviewLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, rootDir, path, selectedId, previewDark])

  function handleCreateSnapshot(): void {
    setCreatingSnapshot(true)
    void Promise.resolve(onCreateSnapshot(dialogContext))
      .then(async (entry) => {
        if (!entry) return
        await reloadEntries(entry.id)
      })
      .finally(() => setCreatingSnapshot(false))
  }

  useEffect(() => {
    if (!open) {
      setContextMenu(null)
      setViewMode('preview')
    }
  }, [open])

  useEffect(() => {
    if (!open || viewMode !== 'diff') {
      diffFlushKeyRef.current = ''
      return
    }
    if (!path) return
    if (!shouldFlushEditorBeforeHistoryDiff({ dialogPath: path, activePath })) return
    const flushKey = `${path}:${activePath ?? ''}`
    if (diffFlushKeyRef.current === flushKey) return
    diffFlushKeyRef.current = flushKey
    const flush = flushEditorToMemoryRef.current
    if (!flush) return
    void flush({
      preserveCodeBlockEditing: true,
      skipTabSessionCapture: true,
    })
  }, [activePath, open, path, viewMode])

  useEffect(() => {
    if (!contextMenu) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.button === 2) return
      if (contextMenuRef.current?.contains(e.target as Node)) return
      setContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setContextMenu(null)
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [contextMenu])

  function openContextMenu(
    e: ReactMouseEvent,
    target: DocumentHistoryContextMenuState['target'],
    entryId?: string,
  ): void {
    e.preventDefault()
    e.stopPropagation()
    if (entryId) setSelectedId(entryId)
    const { x, y } = clampHistoryContextMenuPosition(e.clientX, e.clientY)
    setContextMenu({ x, y, target, entryId })
  }

  function closeContextMenu(): void {
    setContextMenu(null)
  }

  function handleRestoreSnapshot(snapshotId: string): void {
    closeContextMenu()
    void (async () => {
      try {
        await Promise.resolve(onRestore(snapshotId, dialogContext))
        onClose()
      } catch {
        /* parent reports failure via status UI; keep dialog open */
      }
    })()
  }

  function handleDeleteSnapshot(snapshotId: string): void {
    closeContextMenu()
    removeSnapshot(snapshotId, entries.findIndex((item) => item.id === snapshotId))
  }

  function removeSnapshot(snapshotId: string, selectedIndex: number): void {
    const entry = entries.find((item) => item.id === snapshotId)
    if (!entry) return
    void Promise.resolve(onConfirmDeleteSnapshot(entry)).then((confirmed) => {
      if (!confirmed) return
      void deleteDocumentSnapshot({ rootDir, path, snapshotId }).then(async () => {
        if (snapshotId === currentRestoredSnapshotId) {
          resumeAutosaveForPath(path)
        }
        const next = await listDocumentSnapshots({ rootDir, path })
        setEntries(next)
        const fallbackIndex = selectedIndex >= next.length ? next.length - 1 : selectedIndex
        setSelectedId(next[Math.max(0, fallbackIndex)]?.id ?? '')
      })
    })
  }

  function handleDeleteAllSnapshots(): void {
    if (entries.length === 0 || deletingAll) return
    closeContextMenu()
    setDeletingAll(true)
    void Promise.resolve(onDeleteAllSnapshots(dialogContext))
      .then(async (confirmed) => {
        if (!confirmed) return
        setEntries([])
        setSelectedId('')
        setPreview(null)
        setPreviewHtml('')
      })
      .finally(() => setDeletingAll(false))
  }

  const handleSplitResizeStart = useCallback((startX: number, handleEl: HTMLElement, pointerId: number) => {
    const startWidth = sidebarWidth
    beginVerticalSplitDrag({
      handle: handleEl,
      pointerId,
      onMove: (clientX) => {
        const next = startWidth + (clientX - startX)
        setSidebarWidth(Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, next)))
      },
    })
  }, [sidebarWidth])

  const handlePreviewModeKeyDown = useCallback(
    (mode: 'preview' | 'diff') => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (mode === 'diff' && !preview) return
        setViewMode(mode)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (mode === 'preview' && preview) {
          setViewMode('diff')
          window.requestAnimationFrame(() => document.getElementById(diffTabId)?.focus())
        }
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (mode === 'diff') {
          setViewMode('preview')
          window.requestAnimationFrame(() => document.getElementById(previewTabId)?.focus())
        }
      }
    },
    [preview, diffTabId, previewTabId],
  )

  const isCurrentRestored = selectedEntry?.id === currentRestoredSnapshotId
  const restoreTitle = isCurrentRestored
    ? t('app.history.dialog.restoreCurrentHint')
    : t('app.history.dialog.restoreHint')
  const hasSnapshots = entries.length > 0
  const showSplit = !loading && hasSnapshots

  useEffect(() => {
    if (!showSplit || !historyListRef.current) return
    return bindOverlayScrollbarReveal(historyListRef.current)
  }, [showSplit, entries.length, selectedId])

  useEffect(() => {
    if (!showSplit || !historyPreviewBodyRef.current) return
    return bindOverlayScrollbarReveal(historyPreviewBodyRef.current)
  }, [showSplit, viewMode, selectedId])

  const handleCloseButtonMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }, [onClose])

  if (!open) return null

  const dialog = (
    <div
      className="app-dialog-backdrop document-history-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={[
          'app-dialog',
          'document-history-dialog',
          loading ? 'document-history-dialog--loading' : '',
          !loading && !hasSnapshots ? 'document-history-dialog--empty' : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-history-title"
        aria-describedby="document-history-desc"
        onMouseDown={(e) => {
          e.stopPropagation()
          if (contextMenu && !contextMenuRef.current?.contains(e.target as Node)) {
            setContextMenu(null)
          }
        }}
      >
        <header className="document-history-header">
          <div className="document-history-header-copy">
            <h2 id="document-history-title" className="document-history-title">
              {t('app.history.dialog.title')}
              <span className="document-history-title-sep" aria-hidden="true">·</span>
              <span className="document-history-subtitle" title={path}>
                {formatHistoryPath(path)}
              </span>
              {!loading && hasSnapshots ? (
                <span className="document-history-title-count">
                  {t('app.history.dialog.count', { count: entries.length })}
                </span>
              ) : null}
            </h2>
            <p id="document-history-desc" className="document-history-sr-only">
              {t('app.history.dialog.help')}
            </p>
          </div>
          <button
            type="button"
            className="document-history-icon-btn document-history-close"
            aria-label={t('app.history.dialog.close')}
            onMouseDown={handleCloseButtonMouseDown}
            onClick={onClose}
          >
            <Icon name="close" size="sm" tone="muted" stroke="regular" />
          </button>
        </header>

        {showListLoadingFeedback ? (
          <DocumentHistoryListLoadingSkeleton
            label={t('app.history.dialog.loading')}
            sidebarWidth={sidebarWidth}
          />
        ) : null}

        {!loading && listLoadError ? (
          <div className="document-history-empty-pane">
            <p className="document-history-empty-text">{t('app.history.dialog.listFailed')}</p>
            <SettingsButton
              type="button"
              variant="primary"
              onClick={() => {
                setLoading(true)
                void reloadEntries().finally(() => setLoading(false))
              }}
            >
              {t('ai.rail.retry')}
            </SettingsButton>
          </div>
        ) : null}

        {!loading && !listLoadError && !hasSnapshots ? (
          <div className="document-history-empty-pane">
            <p className="document-history-empty-text">{t('app.history.noSnapshots')}</p>
            <SettingsButton
              type="button"
              variant="primary"
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
            >
              {creatingSnapshot ? t('app.history.dialog.creating') : t('menu.file.history.createSnapshot')}
            </SettingsButton>
          </div>
        ) : null}

        {showSplit ? (
          <>
            <div
              className="document-history-split"
              onContextMenu={(e) => openContextMenu(e, 'surface')}
            >
              <aside className="document-history-sidebar" style={{ width: sidebarWidth }}>
                <div
                  ref={historyListRef}
                  className="document-history-list"
                  onContextMenu={(e) => {
                    if ((e.target as HTMLElement).closest('.document-history-entry')) return
                    openContextMenu(e, 'surface')
                  }}
                >
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={[
                        'document-history-entry',
                        entry.id === selectedId ? 'document-history-entry--selected' : '',
                        entry.id === currentRestoredSnapshotId ? 'document-history-entry--current' : '',
                      ].filter(Boolean).join(' ')}
                      onContextMenu={(e) => openContextMenu(e, 'entry', entry.id)}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className="document-history-entry-main"
                        aria-current={entry.id === selectedId ? 'true' : undefined}
                      >
                        <span className="document-history-entry-time">{formatEntryLabel(entry.createdAt)}</span>
                        <span className="document-history-entry-summary" title={resolveSnapshotEntrySummary(t, entry)}>
                          {resolveSnapshotEntrySummary(t, entry)}
                        </span>
                        {entry.source === 'pre_restore' || entry.id === currentRestoredSnapshotId ? (
                          <span className="document-history-entry-note">
                            {[
                              entry.source === 'pre_restore' ? sourceLabel(t, entry) : null,
                              entry.id === currentRestoredSnapshotId ? t('app.history.dialog.restoreCurrent') : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="document-history-sidebar-foot">
                  <button
                    type="button"
                    className="document-history-sidebar-create"
                    onClick={handleCreateSnapshot}
                    disabled={creatingSnapshot}
                  >
                    <Icon name="snapshot" size="sm" tone="muted" stroke="regular" />
                    {creatingSnapshot ? t('app.history.dialog.creating') : t('menu.file.history.createSnapshot')}
                  </button>
                </div>
              </aside>
              <div
                className="resize-handle resize-handle-sidebar document-history-split-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label={t('app.history.dialog.resizeSplit')}
                aria-valuemin={SIDEBAR_WIDTH_MIN}
                aria-valuemax={SIDEBAR_WIDTH_MAX}
                aria-valuenow={sidebarWidth}
                tabIndex={0}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  handleSplitResizeStart(e.clientX, e.currentTarget, e.pointerId)
                }}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  handleVerticalResizeKeyDown(e, {
                    value: sidebarWidth,
                    min: SIDEBAR_WIDTH_MIN,
                    max: SIDEBAR_WIDTH_MAX,
                    step: SIDEBAR_WIDTH_STEP,
                    onChange: setSidebarWidth,
                  })
                }}
                title={t('app.history.dialog.resizeSplit')}
              />
              <section
                className={[
                  'document-history-preview-panel',
                  viewMode === 'diff' ? 'document-history-preview-panel--diff' : '',
                ].filter(Boolean).join(' ')}
                onContextMenu={(e) => openContextMenu(e, 'surface')}
              >
                {selectedEntry ? (
                  <div className="document-history-preview-toolbar">
                    <div className="document-history-preview-modes" role="tablist" aria-label={t('app.history.dialog.preview')}>
                      <button
                        type="button"
                        role="tab"
                        id={previewTabId}
                        aria-selected={viewMode === 'preview'}
                        aria-controls={previewPanelId}
                        tabIndex={viewMode === 'preview' ? 0 : -1}
                        className={`document-history-preview-mode${viewMode === 'preview' ? ' is-active' : ''}`}
                        onClick={() => setViewMode('preview')}
                        onKeyDown={handlePreviewModeKeyDown('preview')}
                      >
                        {t('app.history.dialog.preview')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        id={diffTabId}
                        aria-selected={viewMode === 'diff'}
                        aria-controls={previewPanelId}
                        tabIndex={viewMode === 'diff' ? 0 : -1}
                        className={`document-history-preview-mode${viewMode === 'diff' ? ' is-active' : ''}`}
                        onClick={() => setViewMode('diff')}
                        onKeyDown={handlePreviewModeKeyDown('diff')}
                        disabled={!preview}
                      >
                        {t('app.history.dialog.diff')}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div
                  ref={historyPreviewBodyRef}
                  id={previewPanelId}
                  role="tabpanel"
                  aria-labelledby={viewMode === 'preview' ? previewTabId : diffTabId}
                  className={[
                    'document-history-preview-body preview-pane',
                    viewMode === 'diff' ? 'document-history-preview-body--diff' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {previewLoading && showPreviewLoadingFeedback ? (
                    <DocumentHistoryPreviewLoadingSkeleton label={t('app.history.dialog.loadingPreview')} />
                  ) : preview && viewMode === 'preview' ? (
                    previewHtml ? (
                      <article className="markdown-body document-history-preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                      <pre className="document-history-preview-fallback document-history-preview-content">{preview.content}</pre>
                    )
                  ) : preview && viewMode === 'diff' ? (
                    diffHasChanges ? (
                      <div className="document-history-diff" role="table" aria-label={t('app.history.dialog.diff')}>
                        <div className="document-history-diff-header" role="row">
                          <span role="columnheader" className="document-history-diff-line">#</span>
                          <span role="columnheader">{t('app.history.dialog.currentBody')}</span>
                          <span role="columnheader">{t('app.history.dialog.snapshotBody')}</span>
                        </div>
                        {diffRows.map((row) => (
                          <div
                            key={`${row.lineNo}-${row.kind}`}
                            className={`document-history-diff-row document-history-diff-row--${row.kind}`}
                            role="row"
                          >
                            <span className="document-history-diff-line" role="cell">{row.lineNo}</span>
                            <code className="document-history-diff-cell" role="cell">{row.current || ' '}</code>
                            <code className="document-history-diff-cell" role="cell">{row.snapshot || ' '}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="document-history-preview-empty">{t('app.history.dialog.diffSame')}</p>
                    )
                  ) : (
                    <p className="document-history-preview-empty">{t('app.history.dialog.selectSnapshot')}</p>
                  )}
                </div>
              </section>
            </div>

            <footer className="document-history-footer">
              <button
                type="button"
                className="document-history-footer-link document-history-delete-all"
                onClick={handleDeleteAllSnapshots}
                disabled={deletingAll}
              >
                {deletingAll ? t('app.history.dialog.deletingAll') : t('app.history.dialog.deleteAll')}
              </button>
              <div className="document-history-footer-actions">
                <SettingsButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!selectedEntry) return
                    handleDeleteSnapshot(selectedEntry.id)
                  }}
                  disabled={!selectedEntry || deletingAll}
                >
                  {t('app.history.dialog.delete')}
                </SettingsButton>
                <SettingsButton
                  type="button"
                  variant="primary"
                  title={restoreTitle}
                  onClick={() => {
                    if (!selectedEntry || selectedEntry.id === currentRestoredSnapshotId) return
                    handleRestoreSnapshot(selectedEntry.id)
                  }}
                  disabled={!selectedEntry || selectedEntry.id === currentRestoredSnapshotId || deletingAll}
                >
                  {isCurrentRestored
                    ? t('app.history.dialog.restoreCurrent')
                    : t('app.history.dialog.restoreSnapshot')}
                </SettingsButton>
              </div>
            </footer>
          </>
        ) : null}

        {contextMenu ? (
          <DocumentHistoryContextMenu
            t={t}
            state={contextMenu}
            menuRef={contextMenuRef}
            creatingSnapshot={creatingSnapshot}
            restoreDisabled={contextRestoreDisabled}
            restoreEntryId={contextRestoreId}
            onCreateSnapshot={() => {
              closeContextMenu()
              handleCreateSnapshot()
            }}
            onRestore={handleRestoreSnapshot}
            onDelete={handleDeleteSnapshot}
            onCloseDialog={() => {
              closeContextMenu()
              onClose()
            }}
          />
        ) : null}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog
}
