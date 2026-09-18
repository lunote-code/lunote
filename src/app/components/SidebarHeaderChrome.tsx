import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons/Icon'
import type { SemanticIconName } from '../../design-system/icons/iconRegistry'
import type { SidebarPanelView } from '../workspace/sidebarPanelView'
import { FileContextMenuItem } from './FileContextMenuItem'
import {
  computeSidebarHeaderVisibleViews,
  splitSidebarHeaderViews,
} from './sidebarHeaderToolbarLayout'

type ViewItem = {
  id: SidebarPanelView
  icon: SemanticIconName
  label: string
  ariaLabel: string
  testId: string
  disabled?: boolean
}

type SidebarPanelViewSegmentedProps = {
  t: TranslateFn
  view: SidebarPanelView
  filesDisabled: boolean
  noteCalendarButtonEnabled?: boolean
  onSelectView: (view: SidebarPanelView) => void
}

type SidebarHeaderToolbarProps = SidebarPanelViewSegmentedProps & {
  showSearchToggle: boolean
  searchToggle: ReactNode
  workspaceMenu: ReactNode
}

function buildViewItems(
  t: TranslateFn,
  filesDisabled: boolean,
  noteCalendarButtonEnabled: boolean,
): ViewItem[] {
  const items: ViewItem[] = [
    {
      id: 'files-list',
      icon: 'list',
      label: t('app.sidebar.filesListView'),
      ariaLabel: t('app.sidebar.filesListViewAria'),
      testId: 'sidebar-files-list-toggle',
      disabled: filesDisabled,
    },
    {
      id: 'files-tree',
      icon: 'workspace-tree',
      label: t('app.sidebar.filesTreeView'),
      ariaLabel: t('app.sidebar.filesTreeViewAria'),
      testId: 'sidebar-files-tree-toggle',
      disabled: filesDisabled,
    },
    {
      id: 'outline',
      icon: 'outline',
      label: t('app.sidebar.toggleOutlineOnly'),
      ariaLabel: t('app.sidebar.toggleOutlineAria'),
      testId: 'sidebar-outline-toggle',
    },
  ]

  if (noteCalendarButtonEnabled) {
    items.push({
      id: 'calendar',
      icon: 'sort-created',
      label: t('app.sidebar.noteCalendarView'),
      ariaLabel: t('app.sidebar.noteCalendarViewAria'),
      testId: 'sidebar-calendar-toggle',
      disabled: filesDisabled,
    })
  }

  return items
}

function SidebarPanelViewButton({
  item,
  active,
  onSelect,
}: {
  item: ViewItem
  active: boolean
  onSelect: (view: SidebarPanelView) => void
}) {
  return (
    <button
      type="button"
      className={`sidebar-chrome-btn${active ? ' sidebar-chrome-btn--active' : ''}`}
      onClick={() => onSelect(item.id)}
      disabled={item.disabled}
      aria-pressed={active}
      aria-label={item.ariaLabel}
      title={item.label}
      data-testid={item.testId}
    >
      <Icon name={item.icon} size="sm" stroke="strong" />
    </button>
  )
}

export function SidebarHeaderToolbar({
  t,
  view,
  filesDisabled,
  noteCalendarButtonEnabled = true,
  onSelectView,
  showSearchToggle,
  searchToggle,
  workspaceMenu,
}: SidebarHeaderToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const overflowAnchorRef = useRef<HTMLDivElement>(null)
  const overflowPopRef = useRef<HTMLDivElement>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [overflowPopStyle, setOverflowPopStyle] = useState<CSSProperties | null>(null)
  const viewItems = useMemo(
    () => buildViewItems(t, filesDisabled, noteCalendarButtonEnabled),
    [t, filesDisabled, noteCalendarButtonEnabled],
  )
  const [layout, setLayout] = useState(() => ({
    maxVisible: 1,
    needsOverflow: viewItems.length > 1,
  }))
  const viewIds = useMemo(() => viewItems.map((item) => item.id), [viewItems])
  const itemById = useMemo(() => new Map(viewItems.map((item) => [item.id, item])), [viewItems])
  const trailingSlotCount = (showSearchToggle ? 1 : 0) + 1

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const measure = () => {
      const next = computeSidebarHeaderVisibleViews(
        toolbar.clientWidth,
        viewItems.length,
        trailingSlotCount,
      )
      setLayout(next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [viewItems.length, trailingSlotCount])

  const { visible, overflow } = useMemo(
    () =>
      splitSidebarHeaderViews(
        viewIds,
        view,
        layout.needsOverflow ? layout.maxVisible : viewItems.length,
      ),
    [viewIds, view, layout.maxVisible, layout.needsOverflow, viewItems.length],
  )

  useLayoutEffect(() => {
    if (!overflowOpen) return
    const anchor = overflowAnchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setOverflowPopStyle({
      position: 'fixed',
      left: Math.max(8, rect.right - 200),
      top: rect.bottom + 4,
      visibility: 'visible',
      pointerEvents: 'auto',
    })
  }, [overflowOpen, layout.maxVisible, layout.needsOverflow, visible.length, overflow.length])

  useEffect(() => {
    if (!overflowOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (overflowAnchorRef.current?.contains(target)) return
      if (overflowPopRef.current?.contains(target)) return
      setOverflowOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown, true)
    return () => window.removeEventListener('mousedown', onPointerDown, true)
  }, [overflowOpen])

  useEffect(() => {
    if (overflow.length === 0) {
      setOverflowOpen(false)
    }
  }, [overflow.length])

  return (
    <div
      ref={toolbarRef}
      className="sidebar-header-toolbar"
      data-testid="sidebar-header-toolbar"
    >
      <div
        className="sidebar-list-mode-row sidebar-header-toolbar-views"
        role="group"
        aria-label={t('app.sidebar.panelViewGroupAria')}
        data-testid="sidebar-panel-view-segmented"
      >
        {visible.map((viewId) => {
          const item = itemById.get(viewId)
          if (!item) return null
          return (
            <SidebarPanelViewButton
              key={viewId}
              item={item}
              active={view === viewId}
              onSelect={onSelectView}
            />
          )
        })}
        {layout.needsOverflow && overflow.length > 0 ? (
          <div className="sidebar-header-overflow-anchor" ref={overflowAnchorRef}>
            <button
              type="button"
              className={`sidebar-chrome-btn sidebar-header-overflow-btn${overflowOpen ? ' sidebar-chrome-btn--active' : ''}${overflow.some((viewId) => viewId === view) ? ' sidebar-header-overflow-btn--contains-active' : ''}`}
              aria-label={t('app.sidebar.headerOverflowAria')}
              title={t('app.sidebar.headerOverflowAria')}
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              data-testid="sidebar-header-overflow-toggle"
              onClick={() => setOverflowOpen((open) => !open)}
            >
              <span aria-hidden="true">⋯</span>
            </button>
            {overflowOpen ? (
              <div
                ref={overflowPopRef}
                className="workspace-menu-pop sidebar-header-overflow-pop"
                role="menu"
                aria-label={t('app.sidebar.headerOverflowMenu')}
                style={
                  overflowPopStyle ?? {
                    position: 'fixed',
                    visibility: 'hidden',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                  }
                }
                onContextMenu={(event) => event.preventDefault()}
              >
                {overflow.map((viewId) => {
                  const item = itemById.get(viewId)
                  if (!item) return null
                  return (
                    <FileContextMenuItem
                      key={viewId}
                      icon={item.icon}
                      label={item.label}
                      disabled={item.disabled}
                      testId={item.testId}
                      onClick={() => {
                        onSelectView(viewId)
                        setOverflowOpen(false)
                      }}
                    />
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="sidebar-header-toolbar-trailing">
        {showSearchToggle ? searchToggle : null}
        {workspaceMenu}
      </div>
    </div>
  )
}

/** @deprecated Prefer SidebarHeaderToolbar; kept for narrow QA harnesses. */
export function SidebarPanelViewSegmented(props: SidebarPanelViewSegmentedProps) {
  return (
    <div
      className="sidebar-list-mode-row"
      role="group"
      aria-label={props.t('app.sidebar.panelViewGroupAria')}
      data-testid="sidebar-panel-view-segmented"
    >
      {buildViewItems(props.t, props.filesDisabled, props.noteCalendarButtonEnabled ?? true).map(
        (item) => (
          <SidebarPanelViewButton
            key={item.id}
            item={item}
            active={props.view === item.id}
            onSelect={props.onSelectView}
          />
        ),
      )}
    </div>
  )
}
