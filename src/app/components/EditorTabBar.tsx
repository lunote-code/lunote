import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { LunaHintPopover } from '../../components/LunaHintPopover'
import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import { formatCommandShortcutDisplay } from '../../menu'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { clampMenuElementPosition } from '../../lib/contextMenuPosition'
import { resolveTabStatusHints } from '../../lib/manualSaveStatusMessage'
import { hasExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import { isPathDirty } from '../../lib/documentDirty'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'
import {
  getHistoryRestoreRevision,
  isAutosaveSuspended,
  subscribeHistoryRestoreState,
} from '../../documentHistory/historyRestoreState'
import { logTabNav } from '../../lib/tabNavigationDebug'
import {
  insertBeforeIndexToMoveTarget,
  isNoOpTabReorder,
} from '../../lib/moveItemInArray'
import { resolveEditorTabIcon } from '../workspace/resolveEditorTabIcon'
import { WORKSPACE_FILE_DRAG_THRESHOLD_PX } from '../workspace/workspaceDrag'
import {
  MAX_OPEN_DOCUMENT_TABS,
  isAtOpenTabLimit,
  isNearOpenTabLimit,
} from '../document/openTabLimits'

type Props = {
  t: TranslateFn
  openedTabs: string[]
  activePath: string
  externalDiskChangedPaths: ReadonlySet<string>
  tabLabel: (path: string) => string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onContextMenu: (e: MouseEvent, path: string, index: number) => void
  onExternalBadgeClick?: (path: string) => void
  leadingSlot?: ReactNode
  trailingActions?: ReactNode
  onOpenGlobalSearch?: () => void
}

const EDITOR_TAB_DRAGGING_BODY_CLASS = 'is-editor-tab-dragging'
const TAB_LIST_POSITION_MAX_FRAMES = 180

type TabDragSession = {
  fromIndex: number
  pointerId: number
  startX: number
  startY: number
  grabOffsetX: number
  grabOffsetY: number
  dragging: boolean
}

type TabDragVisualState = {
  fromIndex: number
  insertBefore: number
  ghostX: number
  ghostY: number
  indicatorLeft: number
  label: string
  icon: ReturnType<typeof resolveEditorTabIcon>
  dirty: boolean
  active: boolean
}

function tabDomId(path: string): string {
  return `editor-tab-${encodeURIComponent(path)}`
}

export function EditorTabBar({
  t,
  openedTabs,
  activePath,
  externalDiskChangedPaths,
  tabLabel,
  onActivate,
  onClose,
  onReorder,
  onContextMenu,
  onExternalBadgeClick,
  leadingSlot,
  trailingActions,
  onOpenGlobalSearch,
}: Props) {
  const historyRestoreRevision = useSyncExternalStore(
    subscribeHistoryRestoreState,
    getHistoryRestoreRevision,
    getHistoryRestoreRevision,
  )
  const [dragVisual, setDragVisual] = useState<TabDragVisualState | null>(null)
  const dragSessionRef = useRef<TabDragSession | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const suppressClickRef = useRef(false)
  const tabsStripRef = useRef<HTMLDivElement | null>(null)
  const tabListTriggerRef = useRef<HTMLButtonElement | null>(null)
  const tabListPanelRef = useRef<HTMLDivElement | null>(null)
  const [tabListOpen, setTabListOpen] = useState(false)
  const [tabListStyle, setTabListStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const tabListMenuId = useId().replace(/:/g, '')
  const setRowRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(index, el)
    else rowRefs.current.delete(index)
  }, [])

  const resolveInsertBeforeIndex = useCallback(
    (clientX: number): number => {
      for (let i = 0; i < openedTabs.length; i++) {
        const el = rowRefs.current.get(i)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (clientX >= rect.left && clientX <= rect.right) {
          const mid = rect.left + rect.width / 2
          return clientX < mid ? i : i + 1
        }
      }
      const last = rowRefs.current.get(openedTabs.length - 1)
      if (last && clientX > last.getBoundingClientRect().right) return openedTabs.length
      const first = rowRefs.current.get(0)
      if (first && clientX < first.getBoundingClientRect().left) return 0
      return openedTabs.length
    },
    [openedTabs.length],
  )

  const computeDropIndicatorLeft = useCallback((insertBefore: number): number => {
    const strip = tabsStripRef.current
    if (!strip || openedTabs.length === 0) return 0

    if (insertBefore <= 0) {
      const first = rowRefs.current.get(0)
      return first ? Math.max(0, first.offsetLeft - 3) : 0
    }
    if (insertBefore >= openedTabs.length) {
      const last = rowRefs.current.get(openedTabs.length - 1)
      return last ? last.offsetLeft + last.offsetWidth + 3 : 0
    }
    const row = rowRefs.current.get(insertBefore)
    return row ? Math.max(0, row.offsetLeft - 3) : 0
  }, [openedTabs.length])

  const endDragSession = useCallback(() => {
    dragSessionRef.current = null
    setDragVisual(null)
    document.body.classList.remove(EDITOR_TAB_DRAGGING_BODY_CLASS)
  }, [])

  const finishDrag = useCallback(
    (session: TabDragSession, insertBefore: number) => {
      if (!isNoOpTabReorder(session.fromIndex, insertBefore)) {
        const toIndex = insertBeforeIndexToMoveTarget(session.fromIndex, insertBefore)
        onReorder(session.fromIndex, toIndex)
      }
      suppressClickRef.current = session.dragging
    },
    [onReorder],
  )

  const updateDragVisuals = useCallback(
    (session: TabDragSession, clientX: number, clientY: number) => {
      const insertBefore = resolveInsertBeforeIndex(clientX)
      const path = openedTabs[session.fromIndex]
      if (!path) return
      setDragVisual({
        fromIndex: session.fromIndex,
        insertBefore,
        ghostX: clientX - session.grabOffsetX,
        ghostY: clientY - session.grabOffsetY,
        indicatorLeft: computeDropIndicatorLeft(insertBefore),
        label: tabLabel(path),
        icon: resolveEditorTabIcon(path),
        dirty: isPathDirty(path),
        active: pathsEqual(activePath, path),
      })
    },
    [activePath, computeDropIndicatorLeft, openedTabs, resolveInsertBeforeIndex, tabLabel],
  )

  const autoScrollTabStrip = useCallback((clientX: number) => {
    const strip = tabsStripRef.current
    if (!strip) return
    const rect = strip.getBoundingClientRect()
    const edge = 32
    if (clientX < rect.left + edge) strip.scrollLeft -= 10
    else if (clientX > rect.right - edge) strip.scrollLeft += 10
  }, [])

  const scrollActiveTabIntoView = useCallback(() => {
    const strip = tabsStripRef.current
    if (!strip || !activePath) return
    const activeIndex = openedTabs.findIndex((path) => pathsEqual(path, activePath))
    if (activeIndex < 0) return
    const row = rowRefs.current.get(activeIndex)
    if (!row) return

    const padding = 8
    const rowLeft = row.offsetLeft
    const rowRight = rowLeft + row.offsetWidth
    const viewLeft = strip.scrollLeft
    const viewRight = viewLeft + strip.clientWidth

    if (rowLeft < viewLeft + padding) {
      strip.scrollLeft = Math.max(0, rowLeft - padding)
    } else if (rowRight > viewRight - padding) {
      strip.scrollLeft = rowRight - strip.clientWidth + padding
    }
  }, [activePath, openedTabs])

  useLayoutEffect(() => {
    scrollActiveTabIntoView()
  }, [scrollActiveTabIntoView, openedTabs.length, activePath])

  const closeTabListMenu = useCallback(() => setTabListOpen(false), [])

  useLayoutEffect(() => {
    if (!tabListOpen) {
      setTabListStyle({ visibility: 'hidden' })
      return
    }

    let frame = 0
    let attempts = 0
    const position = () => {
      attempts += 1
      if (attempts > TAB_LIST_POSITION_MAX_FRAMES) {
        setTabListStyle({ visibility: 'hidden' })
        return
      }
      const trigger = tabListTriggerRef.current
      const panel = tabListPanelRef.current
      if (!trigger || !panel) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const anchorRect = trigger.getBoundingClientRect()
      const preferredLeft = anchorRect.right - panel.offsetWidth
      const preferredTop = anchorRect.bottom + 4
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const { x: left, y: top } = clampMenuElementPosition(panel, preferredLeft, preferredTop)
      setTabListStyle({
        left,
        top,
        visibility: 'visible',
        minWidth: Math.max(220, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [tabListOpen, openedTabs.length, activePath])

  useEffect(() => {
    if (!tabListOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (tabListTriggerRef.current?.contains(target)) return
      if (tabListPanelRef.current?.contains(target)) return
      closeTabListMenu()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeTabListMenu()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closeTabListMenu, tabListOpen])

  useEffect(() => {
    if (!dragVisual) return

    const onWindowPointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || !session.dragging || session.pointerId !== e.pointerId) return
      updateDragVisuals(session, e.clientX, e.clientY)
      autoScrollTabStrip(e.clientX)
    }

    window.addEventListener('pointermove', onWindowPointerMove)
    return () => window.removeEventListener('pointermove', onWindowPointerMove)
  }, [autoScrollTabStrip, dragVisual, updateDragVisuals])

  const beginDrag = useCallback(
    (session: TabDragSession, rowEl: HTMLDivElement, clientX: number, clientY: number) => {
      session.dragging = true
      document.body.classList.add(EDITOR_TAB_DRAGGING_BODY_CLASS)
      const rowRect = rowEl.getBoundingClientRect()
      session.grabOffsetX = clientX - rowRect.left
      session.grabOffsetY = clientY - rowRect.top
      updateDragVisuals(session, clientX, clientY)
    },
    [updateDragVisuals],
  )

  const onTabPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('.editor-tab-close')) return
      const rowEl = rowRefs.current.get(index)
      dragSessionRef.current = {
        fromIndex: index,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffsetX: 0,
        grabOffsetY: 0,
        dragging: false,
      }
      suppressClickRef.current = false
      if (rowEl) {
        const rowRect = rowEl.getBoundingClientRect()
        dragSessionRef.current.grabOffsetX = e.clientX - rowRect.left
        dragSessionRef.current.grabOffsetY = e.clientY - rowRect.top
      }
    },
    [],
  )

  const onTabPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== e.pointerId) return
      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY
      if (!session.dragging) {
        if (Math.hypot(dx, dy) < WORKSPACE_FILE_DRAG_THRESHOLD_PX) return
        const rowEl = rowRefs.current.get(session.fromIndex)
        if (!rowEl) return
        beginDrag(session, rowEl, e.clientX, e.clientY)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      updateDragVisuals(session, e.clientX, e.clientY)
      autoScrollTabStrip(e.clientX)
    },
    [autoScrollTabStrip, beginDrag, updateDragVisuals],
  )

  const onTabPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== e.pointerId) return
    if (session.dragging) {
      const insertBefore = resolveInsertBeforeIndex(e.clientX)
      finishDrag(session, insertBefore)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }
    endDragSession()
  }, [endDragSession, finishDrag, resolveInsertBeforeIndex])

  const onTabPointerCancel = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== e.pointerId) return
    if (session.dragging) {
      suppressClickRef.current = true
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }
    endDragSession()
  }, [endDragSession])

  const focusTabAt = (index: number) => {
    const path = openedTabs[index]
    if (!path) return
    document.getElementById(tabDomId(path))?.focus()
  }

  const isReordering = dragVisual !== null
  const dropIsValid =
    dragVisual !== null && !isNoOpTabReorder(dragVisual.fromIndex, dragVisual.insertBefore)
  const tabCount = openedTabs.length
  const nearTabLimit = isNearOpenTabLimit(tabCount)
  const atTabLimit = isAtOpenTabLimit(tabCount)
  const [limitHintAcknowledged, setLimitHintAcknowledged] = useState(false)
  const showGlobalSearchButton = Boolean(onOpenGlobalSearch)

  useEffect(() => {
    if (!nearTabLimit && !atTabLimit) {
      setLimitHintAcknowledged(false)
    }
  }, [nearTabLimit, atTabLimit])
  const stripClass = [
    'editor-tabs-strip',
    isReordering ? 'editor-tabs-strip--reordering' : '',
    nearTabLimit ? 'editor-tabs-strip--near-limit' : '',
    atTabLimit ? 'editor-tabs-strip--at-limit' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={stripClass} data-testid="editor-tabs-strip">
      {dragVisual ? (
        <div
          className={`editor-tab-drag-ghost${dragVisual.active ? ' editor-tab-drag-ghost--active' : ''}`}
          style={{ left: dragVisual.ghostX, top: dragVisual.ghostY }}
          aria-hidden
        >
          <Icon name={dragVisual.icon} size="xs" tone="muted" stroke="regular" className="editor-tab-drag-ghost-icon" />
          <span className="editor-tab-drag-ghost-label">{dragVisual.label}</span>
          {dragVisual.dirty ? <span className="editor-tab-drag-ghost-badge" aria-hidden /> : null}
        </div>
      ) : null}
      <div className="editor-tabs-strip-row">
      {leadingSlot ? <div className="editor-chrome-leading">{leadingSlot}</div> : null}
      {openedTabs.length > 0 ? (
      <div
        ref={tabsStripRef}
        className="editor-tabs"
        role="tablist"
        aria-label={t('app.tabs.aria')}
        data-testid="editor-tabs"
      >
        {isReordering ? (
          <div
            className={`editor-tabs-drop-indicator${dropIsValid ? ' editor-tabs-drop-indicator--valid' : ' editor-tabs-drop-indicator--invalid'}`}
            style={{ left: dragVisual?.indicatorLeft ?? 0 }}
            aria-hidden
          />
        ) : null}
        {openedTabs.map((path, index) => {
          const dirty = isPathDirty(path)
          const external = hasExternalDiskDriftInState(path, externalDiskChangedPaths)
          const historyRestore = historyRestoreRevision >= 0 && isAutosaveSuspended(path)
          const tabHints = resolveTabStatusHints({ t, path, historyRestore, external })
          const isActive = pathsEqual(activePath, path)
          const isDragSource = dragVisual?.fromIndex === index
          const badges: string[] = []
          if (dirty) badges.push('dirty')
          if (historyRestore) badges.push('history')
          if (external) badges.push('external')
          const badgeClass = badges.length > 0 ? ` editor-tab-row--${badges.join('-')}` : ''
          const tabAriaParts = [tabLabel(path)]
          if (dirty) tabAriaParts.push(t('app.tabs.unsavedAria'))
          tabAriaParts.push(...tabHints.ariaStatuses)
          const tabAriaLabel = tabAriaParts.join(' · ')
          const tabIcon = resolveEditorTabIcon(path)
          const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              logTabNav('user-tab-click', { path, index, trigger: 'keyboard', activePath })
              onActivate(path)
              return
            }
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              focusTabAt(index + 1)
              return
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              focusTabAt(index - 1)
              return
            }
            if (e.key === 'Home') {
              e.preventDefault()
              focusTabAt(0)
              return
            }
            if (e.key === 'End') {
              e.preventDefault()
              focusTabAt(openedTabs.length - 1)
            }
          }
          return (
            <div
              key={path}
              ref={(el) => setRowRef(index, el)}
              className={`editor-tab-row${isActive ? ' active' : ''}${badgeClass}${isDragSource ? ' editor-tab-row--drag-source' : ''}${isReordering && !isDragSource ? ' editor-tab-row--dimmed' : ''}`}
            >
              <button
                type="button"
                role="tab"
                id={tabDomId(path)}
                data-testid={`editor-tab:${path.replace(/\\/g, '/').split('/').pop() ?? path}`}
                aria-selected={isActive}
                aria-controls="editor-main-panel"
                tabIndex={isActive ? 0 : -1}
                className={`editor-tab${isActive ? ' active' : ''}`}
                aria-label={tabAriaLabel}
                onMouseDown={preventButtonSecondaryMouseDown}
                onPointerDown={(e) => onTabPointerDown(e, index)}
                onPointerMove={onTabPointerMove}
                onPointerUp={onTabPointerUp}
                onPointerCancel={onTabPointerCancel}
                onContextMenu={(e) => onContextMenu(e, path, index)}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  logTabNav('user-tab-click', { path, index, trigger: 'mouse', activePath })
                  onActivate(path)
                }}
                onKeyDown={onTabKeyDown}
                title={tabHints.title}
              >
                <span className="editor-tab-icon" aria-hidden="true">
                  <Icon name={tabIcon} size="xs" tone="muted" stroke="regular" />
                </span>
                <span className="editor-tab-label">{tabLabel(path)}</span>
                {(dirty || external || historyRestore) && (
                  <span className="editor-tab-badges">
                    {dirty && <span className="editor-tab-badge editor-tab-badge--dirty" />}
                    {historyRestore && <span className="editor-tab-badge editor-tab-badge--history" />}
                    {external && (!onExternalBadgeClick || historyRestore) ? (
                      <span className="editor-tab-badge editor-tab-badge--external" />
                    ) : null}
                  </span>
                )}
              </button>
              {external && onExternalBadgeClick && !historyRestore ? (
                <button
                  type="button"
                  className="editor-tab-badge-btn"
                  title={t('app.tabs.reloadFromDiskHint')}
                  aria-label={t('app.tabs.reloadFromDisk')}
                  data-testid={`editor-tab-external-reload:${path.replace(/\\/g, '/').split('/').pop() ?? path}`}
                  onMouseDown={preventButtonSecondaryMouseDown}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onExternalBadgeClick(path)
                  }}
                >
                  <span className="editor-tab-badge editor-tab-badge--external" />
                </button>
              ) : null}
              <button
                type="button"
                className="editor-tab-close"
                aria-label={t('app.tabs.closeTab')}
                onMouseDown={preventButtonSecondaryMouseDown}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onClose(path)
                }}
              >
                <Icon name="close" size="xs" tone="muted" stroke="strong" />
              </button>
            </div>
          )
        })}
      </div>
      ) : null}
      <div className="editor-chrome-tab-spacer" aria-hidden />
      {openedTabs.length > 0 ? (
      <div className="editor-tabs-capacity" data-testid="editor-tabs-capacity">
        <button
          ref={tabListTriggerRef}
          type="button"
          className={`editor-tabs-count-btn${tabListOpen ? ' is-active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={tabListOpen}
          aria-controls={tabListOpen ? tabListMenuId : undefined}
          aria-label={t('app.tabs.listMenuAria', { current: tabCount, max: MAX_OPEN_DOCUMENT_TABS })}
          data-testid="editor-tabs-list-trigger"
          onMouseDown={preventButtonSecondaryMouseDown}
          onClick={() => setTabListOpen((open) => !open)}
        >
          <Icon
            name={tabListOpen ? 'chevron-down' : 'chevron-right'}
            size="xs"
            tone="muted"
            stroke="strong"
            className="editor-tabs-count-chevron"
            aria-hidden
          />
          <span className="editor-tabs-count" aria-hidden="true">
            {t('app.tabs.countLabel', { current: tabCount, max: MAX_OPEN_DOCUMENT_TABS })}
          </span>
        </button>
        {tabListOpen
          ? createPortal(
              <div
                id={tabListMenuId}
                ref={tabListPanelRef}
                className="editor-tabs-list-menu luna-reveal-popover-shell"
                role="menu"
                aria-label={t('app.tabs.listMenuTitle')}
                data-testid="editor-tabs-list-menu"
                style={tabListStyle}
              >
                {openedTabs.map((path, index) => {
                  const isActive = pathsEqual(activePath, path)
                  const dirty = isPathDirty(path)
                  const external = hasExternalDiskDriftInState(path, externalDiskChangedPaths)
                  const historyRestore = historyRestoreRevision >= 0 && isAutosaveSuspended(path)
                  const tabFileStem = path.replace(/\\/g, '/').split('/').pop() ?? path
                  return (
                    <div
                      key={path}
                      className={`editor-tabs-list-row${isActive ? ' is-active' : ''}`}
                      data-testid={`editor-tabs-list-item:${tabFileStem}`}
                    >
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        className="editor-tabs-list-item"
                        onClick={() => {
                          logTabNav('user-tab-click', { path, index, trigger: 'tab-list-menu', activePath })
                          onActivate(path)
                          closeTabListMenu()
                          requestAnimationFrame(() => scrollActiveTabIntoView())
                        }}
                      >
                        <span className="editor-tabs-list-item-icon" aria-hidden="true">
                          <Icon name={resolveEditorTabIcon(path)} size="xs" tone="muted" stroke="regular" />
                        </span>
                        <span className="editor-tabs-list-item-label">{tabLabel(path)}</span>
                        {(dirty || external || historyRestore) && (
                          <span className="editor-tabs-list-item-badges" aria-hidden="true">
                            {dirty ? <span className="editor-tab-badge editor-tab-badge--dirty" /> : null}
                            {historyRestore ? (
                              <span className="editor-tab-badge editor-tab-badge--history" />
                            ) : null}
                            {external ? <span className="editor-tab-badge editor-tab-badge--external" /> : null}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="editor-tabs-list-close"
                        aria-label={t('app.tabs.closeTab')}
                        data-testid={`editor-tabs-list-close:${tabFileStem}`}
                        onMouseDown={preventButtonSecondaryMouseDown}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onClose(path)
                          if (openedTabs.length <= 1) closeTabListMenu()
                        }}
                      >
                        <Icon name="close" size="xs" tone="muted" stroke="strong" />
                      </button>
                    </div>
                  )
                })}
              </div>,
              document.body,
            )
          : null}
        {nearTabLimit || atTabLimit ? (
          <LunaHintPopover
            title={t(atTabLimit ? 'app.tabs.atLimitTitle' : 'app.tabs.nearLimitTitle')}
            body={t(atTabLimit ? 'app.tabs.atLimitHint' : 'app.tabs.nearLimitHint', {
              max: MAX_OPEN_DOCUMENT_TABS,
            })}
            ariaLabel={t('app.tabs.limitHintAria')}
            icon="callout-warning"
            triggerClassName={[
              'editor-tabs-limit-hint-trigger',
              !limitHintAcknowledged ? 'editor-tabs-limit-hint-trigger--pulse' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onOpenChange={(open) => {
              if (open) setLimitHintAcknowledged(true)
            }}
          />
        ) : null}
      </div>
      ) : null}
      {trailingActions || showGlobalSearchButton ? (
        <div className="editor-chrome-actions">
          {showGlobalSearchButton ? (
            <button
              type="button"
              className={`luna-chrome-icon-btn editor-chrome-action-btn editor-tabs-overflow-btn${nearTabLimit || atTabLimit ? '' : ' editor-tabs-overflow-btn--quiet'}`}
              title={`${t('app.globalSearch.aria')} (${formatCommandShortcutDisplay('view-search')})`}
              aria-label={t('app.globalSearch.aria')}
              data-testid="editor-tabs-overflow-switcher"
              onMouseDown={preventButtonSecondaryMouseDown}
              onClick={onOpenGlobalSearch}
            >
              <Icon name="search" size="sm" stroke="strong" />
            </button>
          ) : null}
          {trailingActions}
        </div>
      ) : null}
      </div>
    </div>
  )
}
