import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { clampMenuElementPosition } from '../../../lib/contextMenuPosition'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import { useMenuListKeyboard } from '../../../lib/useMenuListKeyboard'
import { bridgeRememberInsertAnchor } from '../../editorMutationBridge'
import type { AiQuickActionId } from '../actions/aiQuickActions'
import { AI_FOOTER_PRIMARY_ACTION_IDS, AI_QUICK_ACTIONS } from '../actions/aiQuickActions'

type Props = {
  disabled: boolean
  configured: boolean
  configureFirstTitle: string
  hasEditorSelection: boolean
  isStreaming: boolean
  labelFor: (key: string) => string
  moreMenuAriaLabel: string
  onAction: (actionId: AiQuickActionId) => void
}

const FOOTER_ACTIONS = AI_QUICK_ACTIONS.filter((action) => !action.welcomeOnly)
const PRIMARY_ID_SET = new Set<AiQuickActionId>(AI_FOOTER_PRIMARY_ACTION_IDS)

const HIDDEN_MENU_STYLE: CSSProperties = {
  position: 'fixed',
  visibility: 'hidden',
  left: -9999,
  top: 0,
}

function fixedMenuStyleEqual(prev: CSSProperties, left: number, top: number): boolean {
  return (
    prev.position === 'fixed' &&
    prev.left === left &&
    prev.top === top &&
    prev.zIndex === 'var(--z-overlay-surface-popover, 10050)' &&
    prev.visibility === 'visible'
  )
}

function hiddenMenuStyleEqual(prev: CSSProperties): boolean {
  return (
    prev.position === HIDDEN_MENU_STYLE.position &&
    prev.visibility === HIDDEN_MENU_STYLE.visibility &&
    prev.left === HIDDEN_MENU_STYLE.left &&
    prev.top === HIDDEN_MENU_STYLE.top
  )
}

function isFooterActionVisible(
  action: (typeof FOOTER_ACTIONS)[number],
  hasEditorSelection: boolean,
): boolean {
  if (action.requiresSelection && !hasEditorSelection) return false
  return true
}

export function AiQuickActions({
  disabled,
  configured,
  configureFirstTitle,
  hasEditorSelection,
  isStreaming,
  labelFor,
  moreMenuAriaLabel,
  onAction,
}: Props) {
  const blocked = disabled || isStreaming
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>(HIDDEN_MENU_STYLE)
  const [menuEl, setMenuEl] = useState<HTMLDivElement | null>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const visiblePrimary = FOOTER_ACTIONS.filter(
    (action) => PRIMARY_ID_SET.has(action.id) && isFooterActionVisible(action, hasEditorSelection),
  )
  const visibleOverflow = FOOTER_ACTIONS.filter(
    (action) => !PRIMARY_ID_SET.has(action.id) && isFooterActionVisible(action, hasEditorSelection),
  )

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useFocusTrap(menuOpen, menuEl, {
    onEscape: closeMenu,
  })

  useMenuListKeyboard(menuOpen, menuEl, '[role="menuitem"]:not([disabled])')

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (overflowRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [closeMenu, menuOpen])

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle((prev) => (hiddenMenuStyleEqual(prev) ? prev : HIDDEN_MENU_STYLE))
      return
    }

    let frame = 0
    const positionMenu = () => {
      const anchor = moreButtonRef.current
      const panel = menuRef.current
      if (!anchor || !panel) {
        frame = window.requestAnimationFrame(positionMenu)
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(positionMenu)
        return
      }

      const preferredLeft = anchorRect.right - width
      const preferredTop = anchorRect.top - height - 4
      const { x, y } = clampMenuElementPosition(panel, preferredLeft, preferredTop)

      setMenuStyle((prev) =>
        fixedMenuStyleEqual(prev, x, y)
          ? prev
          : {
              position: 'fixed',
              left: x,
              top: y,
              zIndex: 'var(--z-overlay-surface-popover, 10050)',
              visibility: 'visible',
            },
      )
    }

    setMenuStyle((prev) => (hiddenMenuStyleEqual(prev) ? prev : HIDDEN_MENU_STYLE))
    positionMenu()
    window.addEventListener('resize', positionMenu)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionMenu)
    }
  }, [menuOpen, visibleOverflow.length])

  const handleOverflowAction = (actionId: AiQuickActionId) => {
    closeMenu()
    onAction(actionId)
  }

  const captureInsertAnchor = () => {
    bridgeRememberInsertAnchor()
  }

  const resolveActionTitle = (action: (typeof FOOTER_ACTIONS)[number]): string | undefined => {
    if (blocked && !configured) return configureFirstTitle
    return action.hintKey ? labelFor(action.hintKey) : undefined
  }

  return (
    <div className="ai-rail-quick-actions" data-testid="ai-quick-actions">
      {visiblePrimary.map((action) => {
        const title = resolveActionTitle(action)
        return (
        <button
          key={action.id}
          type="button"
          className="ai-rail-quick-action"
          disabled={blocked}
          title={title}
          onMouseDown={captureInsertAnchor}
          onClick={() => onAction(action.id)}
          data-testid={`ai-quick-action-${action.id}`}
        >
          {labelFor(action.labelKey)}
        </button>
        )
      })}
      {visibleOverflow.length > 0 ? (
        <div className="ai-rail-quick-actions-overflow" ref={overflowRef}>
          <button
            ref={moreButtonRef}
            type="button"
            className={`ai-rail-quick-action ai-rail-quick-action--more${menuOpen ? ' is-active' : ''}`}
            disabled={blocked}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={moreMenuAriaLabel}
            data-testid="ai-quick-action-more"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ···
          </button>
          {menuOpen && typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={(node) => {
                    menuRef.current = node
                    setMenuEl(node)
                  }}
                  className="ai-rail-quick-actions-menu ai-rail-quick-actions-menu--floating"
                  style={menuStyle}
                  role="menu"
                  data-testid="ai-quick-actions-menu"
                >
                  {visibleOverflow.map((action) => {
                    const label = labelFor(action.labelKey)
                    const hint = action.hintKey ? labelFor(action.hintKey) : null
                    const title = blocked && !configured ? configureFirstTitle : hint ?? undefined
                    const ariaLabel = hint ? `${label}. ${hint}` : label
                    return (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      className="ai-rail-quick-actions-menu-item"
                      disabled={blocked}
                      onMouseDown={captureInsertAnchor}
                      onClick={() => handleOverflowAction(action.id)}
                      data-testid={`ai-quick-actions-menu-item-${action.id}`}
                      aria-label={ariaLabel}
                      title={title}
                    >
                      <span className="ai-rail-quick-actions-menu-item-label">{label}</span>
                      {hint ? (
                        <span className="ai-rail-quick-actions-menu-item-hint">{hint}</span>
                      ) : null}
                    </button>
                    )
                  })}
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </div>
  )
}
