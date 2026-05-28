import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { bridgeCaptureEditorSelection } from '../editor/editorMutationBridge'
import { Icon } from '../design-system/icons'
import { useI18n } from '../i18n/provider'
import {
  APP_MENU_SCHEMA,
  formatAcceleratorForDisplay,
  formatTyporaMenuTitle,
  isLeaf,
  isSeparator,
  isSubmenu,
} from '../menu'
import type { MenuBarGroup, MenuLeaf, MenuNode, MenuSubmenu } from '../menu'
import './appMenuBar.css'

type AppMenuBarProps = {
  recentFiles: readonly string[]
  onRunAction: (action: string) => void
  onOpenRecent: (path: string) => void
}

const MENU_LAYER_ATTR = 'data-app-menubar-layer'
const SUBMENU_HOVER_CLOSE_MS = 100

function basename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(i + 1) : norm
}

function isInsideMenuLayer(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(`[${MENU_LAYER_ATTR}]`)
}

type FlyoutAlign = 'below-left' | 'beside-right'

function computeFlyoutPosition(
  anchor: DOMRect,
  panel: HTMLElement,
  align: FlyoutAlign,
): { top: number; left: number } {
  const pad = 8
  const pw = panel.offsetWidth
  const ph = panel.offsetHeight
  let top = align === 'below-left' ? anchor.bottom + 4 : anchor.top - 4
  let left = align === 'below-left' ? anchor.left : anchor.right - 6

  if (align === 'beside-right' && left + pw > window.innerWidth - pad) {
    left = anchor.left - pw + 6
  } else if (left + pw > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - pad - pw)
  }

  if (top + ph > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - pad - ph)
  }
  if (left < pad) left = pad
  if (top < pad) top = pad

  return { top, left }
}

function applyFlyoutPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  align: FlyoutAlign,
): void {
  const anchor = anchorRef.current
  const panel = panelRef.current
  if (!anchor || !panel) return

  const rect = anchor.getBoundingClientRect()
  const { top, left } = computeFlyoutPosition(rect, panel, align)
  panel.style.top = `${top}px`
  panel.style.left = `${left}px`
  panel.style.visibility = 'visible'
}

function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  align: FlyoutAlign,
): void {
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    panel.style.visibility = 'hidden'

    const reposition = () => applyFlyoutPosition(anchorRef, panelRef, align)
    reposition()

    const ro = new ResizeObserver(reposition)
    ro.observe(panel)
    window.addEventListener('resize', reposition)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [anchorRef, panelRef, open, align])
}

const FloatingMenuPanel = memo(function FloatingMenuPanel({
  anchorRef,
  open,
  className,
  align,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  className: string
  align: FlyoutAlign
  children: React.ReactNode
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useFloatingPosition(anchorRef, panelRef, open, align)

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      {...{ [MENU_LAYER_ATTR]: '' }}
      className={className}
      role="menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  )
})

function MenuNodes({
  nodes,
  recentFiles,
  onRunAction,
  onOpenRecent,
}: {
  nodes: readonly MenuNode[]
  recentFiles: readonly string[]
  onRunAction: (action: string) => void
  onOpenRecent: (path: string) => void
}) {
  const { t } = useI18n()
  const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenu | null>(null)
  const activeRowRef = useRef<HTMLDivElement | null>(null)
  const hoverCloseRef = useRef<number | null>(null)

  const clearHoverClose = useCallback(() => {
    if (hoverCloseRef.current != null) {
      window.clearTimeout(hoverCloseRef.current)
      hoverCloseRef.current = null
    }
  }, [])

  const closeSubmenu = useCallback(() => {
    setActiveSubmenu(null)
    activeRowRef.current = null
  }, [])

  const scheduleHoverClose = useCallback(() => {
    clearHoverClose()
    hoverCloseRef.current = window.setTimeout(closeSubmenu, SUBMENU_HOVER_CLOSE_MS)
  }, [clearHoverClose, closeSubmenu])

  const openSubmenu = useCallback(
    (sub: MenuSubmenu, rowEl: HTMLDivElement) => {
      clearHoverClose()
      activeRowRef.current = rowEl
      setActiveSubmenu(sub)
    },
    [clearHoverClose],
  )

  useEffect(() => () => clearHoverClose(), [clearHoverClose])

  const renderLeaf = (leaf: MenuLeaf, labelOverride?: string) => {
    const action = leaf.action ?? leaf.id
    const label = labelOverride ?? formatTyporaMenuTitle(t(leaf.labelKey), leaf.menuIcon)
    const shortcut = formatAcceleratorForDisplay(leaf.accelerator)
    return (
      <button
        key={leaf.id}
        type="button"
        role="menuitem"
        className="app-menubar-item"
        onMouseDown={preventMenuMouseDown}
        onClick={() => onRunAction(action)}
      >
        <span className="app-menubar-item-label">{label}</span>
        {shortcut ? (
          <span className="app-menubar-item-meta">
            <kbd className="app-menubar-shortcut">{shortcut}</kbd>
          </span>
        ) : null}
      </button>
    )
  }

  const renderSubmenu = (sub: MenuSubmenu) => (
    <SubmenuRow
      key={sub.id}
      sub={sub}
      isActive={activeSubmenu?.id === sub.id}
      onOpen={openSubmenu}
      onScheduleClose={scheduleHoverClose}
    />
  )

  return (
    <>
      {nodes.map((node, idx) => {
        if (isSeparator(node)) {
          return <div key={`sep-${idx}`} className="app-menubar-sep" role="separator" />
        }
        if (isSubmenu(node)) {
          return renderSubmenu(node)
        }
        if (isLeaf(node) && node.id === 'file-recent-placeholder') {
          if (recentFiles.length === 0) {
            return (
              <button key={node.id} type="button" className="app-menubar-item" disabled>
                <span className="app-menubar-item-label">{t('menu.file.recent')}</span>
              </button>
            )
          }
          return renderSubmenu({
            kind: 'submenu',
            id: 'sub-recent-dynamic',
            labelKey: 'menu.file.recent',
            children: recentFiles.map((path, i) => ({
              kind: 'item',
              id: `recent-${i}`,
              labelKey: 'menu.file.recent',
              action: `recent:${path}`,
            })),
          })
        }
        if (isLeaf(node) && node.id.startsWith('recent-')) {
          const path = node.action?.startsWith('recent:') ? node.action.slice('recent:'.length) : ''
          if (!path) return null
          return (
            <button
              key={node.id}
              type="button"
              role="menuitem"
              className="app-menubar-item"
              title={path}
              onMouseDown={preventMenuMouseDown}
              onClick={() => onOpenRecent(path)}
            >
              <span className="app-menubar-item-label">{basename(path)}</span>
            </button>
          )
        }
        if (isLeaf(node)) {
          return renderLeaf(node)
        }
        return null
      })}
      <FloatingMenuPanel
        anchorRef={activeRowRef}
        open={activeSubmenu != null}
        className="app-menubar-panel app-menubar-submenu app-menubar-panel--floating"
        align="beside-right"
        onMouseEnter={clearHoverClose}
        onMouseLeave={scheduleHoverClose}
      >
        {activeSubmenu ? (
          <MenuNodes
            nodes={activeSubmenu.children}
            recentFiles={recentFiles}
            onRunAction={onRunAction}
            onOpenRecent={onOpenRecent}
          />
        ) : null}
      </FloatingMenuPanel>
    </>
  )
}

const SubmenuRow = memo(function SubmenuRow({
  sub,
  isActive,
  onOpen,
  onScheduleClose,
}: {
  sub: MenuSubmenu
  isActive: boolean
  onOpen: (sub: MenuSubmenu, rowEl: HTMLDivElement) => void
  onScheduleClose: () => void
}) {
  const { t } = useI18n()
  const rowRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={rowRef}
      className={`app-menubar-row${isActive ? ' is-active' : ''}`}
      onMouseEnter={() => {
        if (rowRef.current) onOpen(sub, rowRef.current)
      }}
      onMouseLeave={onScheduleClose}
    >
      <button
        type="button"
        role="menuitem"
        className="app-menubar-item"
        aria-haspopup="menu"
        onMouseDown={preventMenuMouseDown}
      >
        <span className="app-menubar-item-label">{t(sub.labelKey)}</span>
        <span className="app-menubar-item-meta">
          <Icon name="chevron-right" className="app-menubar-chevron" size="sm" stroke="strong" />
        </span>
      </button>
    </div>
  )
})

function MenuGroup({
  group,
  isOpen,
  anyOpen,
  onOpen,
  onClose,
  recentFiles,
  onRunAction,
  onOpenRecent,
}: {
  group: MenuBarGroup
  isOpen: boolean
  anyOpen: boolean
  onOpen: () => void
  onClose: () => void
  recentFiles: readonly string[]
  onRunAction: (action: string) => void
  onOpenRecent: (path: string) => void
}) {
  const { t } = useI18n()
  const groupRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      if (groupRef.current?.contains(e.target as Node)) return
      if (isInsideMenuLayer(e.target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [isOpen, onClose])

  const handleAction = useCallback(
    (action: string) => {
      onClose()
      onRunAction(action)
    },
    [onClose, onRunAction],
  )

  const handleRecent = useCallback(
    (path: string) => {
      onClose()
      onOpenRecent(path)
    },
    [onClose, onOpenRecent],
  )

  return (
    <div ref={groupRef} className={`app-menubar-group${isOpen ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="app-menubar-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onMouseDown={preventMenuMouseDown}
        onMouseEnter={() => {
          if (anyOpen) onOpen()
        }}
        onClick={() => {
          if (isOpen) onClose()
          else onOpen()
        }}
      >
        {t(group.labelKey)}
      </button>
      <FloatingMenuPanel
        anchorRef={triggerRef}
        open={isOpen}
        className="app-menubar-panel app-menubar-panel--floating"
        align="below-left"
      >
        <MenuNodes
          nodes={group.children}
          recentFiles={recentFiles}
          onRunAction={handleAction}
          onOpenRecent={handleRecent}
        />
      </FloatingMenuPanel>
    </div>
  )
}

function preventMenuMouseDown(e: ReactMouseEvent): void {
  if (e.button === 0 || e.button === 2) e.preventDefault()
}

export function AppMenuBar({ recentFiles, onRunAction, onOpenRecent }: AppMenuBarProps) {
  const menuId = useId()
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const barRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      if (barRef.current?.contains(e.target as Node)) return
      if (isInsideMenuLayer(e.target)) return
      setOpenGroupId(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  return (
    <nav
      ref={barRef}
      id={menuId}
      className="app-menubar"
      role="menubar"
      aria-label="Application menu"
      onMouseDownCapture={(e) => {
        if (e.button === 0) bridgeCaptureEditorSelection()
      }}
    >
      <span className="app-menubar-brand" aria-hidden>
        Lunote
      </span>
      {APP_MENU_SCHEMA.bar.map((group) => (
        <MenuGroup
          key={group.id}
          group={group}
          isOpen={openGroupId === group.id}
          anyOpen={openGroupId != null}
          onOpen={() => setOpenGroupId(group.id)}
          onClose={() => setOpenGroupId(null)}
          recentFiles={recentFiles}
          onRunAction={onRunAction}
          onOpenRecent={onOpenRecent}
        />
      ))}
    </nav>
  )
}
