import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { LunaHintPopover } from '../../components/LunaHintPopover'
import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { isPathDirty } from '../../lib/documentDirty'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'
import { isAutosaveSuspended } from '../../documentHistory/historyRestoreState'
import { logTabNav } from '../../lib/tabNavigationDebug'
import {
  insertBeforeIndexToMoveTarget,
  isNoOpTabReorder,
} from '../../lib/moveItemInArray'
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
}

const EDITOR_TAB_DRAGGING_BODY_CLASS = 'is-editor-tab-dragging'

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
  dirty: boolean
  active: boolean
}

function hasExternalDiskDrift(path: string, externalDiskChangedPaths: ReadonlySet<string>): boolean {
  for (const p of externalDiskChangedPaths) {
    if (pathsEqual(p, path)) return true
  }
  return false
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
}: Props) {
  const [dragVisual, setDragVisual] = useState<TabDragVisualState | null>(null)
  const dragSessionRef = useRef<TabDragSession | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const suppressClickRef = useRef(false)
  const tabsStripRef = useRef<HTMLDivElement | null>(null)
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
          <span className="editor-tab-drag-ghost-label">{dragVisual.label}</span>
          {dragVisual.dirty ? <span className="editor-tab-drag-ghost-badge" aria-hidden /> : null}
        </div>
      ) : null}
      <div className="editor-tabs-strip-row">
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
          const external = hasExternalDiskDrift(path, externalDiskChangedPaths)
          const historyRestore = isAutosaveSuspended(path)
          const isActive = pathsEqual(activePath, path)
          const isDragSource = dragVisual?.fromIndex === index
          const badges: string[] = []
          if (dirty) badges.push('dirty')
          if (external) badges.push('external')
          if (historyRestore) badges.push('history')
          const badgeClass = badges.length > 0 ? ` editor-tab-row--${badges.join('-')}` : ''
          const tabAriaParts = [tabLabel(path)]
          if (dirty) tabAriaParts.push(t('app.tabs.unsavedAria'))
          if (external) tabAriaParts.push(t('app.tabs.externalAria'))
          if (historyRestore) tabAriaParts.push(t('app.tabs.historyRestoreAria'))
          const tabAriaLabel = tabAriaParts.join(' · ')
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
                title={
                  historyRestore
                    ? t('app.tabs.historyRestoreHint')
                    : external
                      ? t('app.tabs.externalDiskHint')
                      : path
                }
              >
                <span className="editor-tab-label">{tabLabel(path)}</span>
                {(dirty || external || historyRestore) && (
                  <span className="editor-tab-badges" aria-hidden="true">
                    {dirty && <span className="editor-tab-badge editor-tab-badge--dirty" />}
                    {external && <span className="editor-tab-badge editor-tab-badge--external" />}
                    {historyRestore && <span className="editor-tab-badge editor-tab-badge--history" />}
                  </span>
                )}
              </button>
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
      <div
        className="editor-tabs-capacity"
        data-testid="editor-tabs-capacity"
        aria-label={t('app.tabs.countAria', { current: tabCount, max: MAX_OPEN_DOCUMENT_TABS })}
      >
        <span className="editor-tabs-count" aria-hidden="true">
          {t('app.tabs.countLabel', { current: tabCount, max: MAX_OPEN_DOCUMENT_TABS })}
        </span>
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
      </div>
    </div>
  )
}
