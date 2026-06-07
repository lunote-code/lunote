import './lunaHintPopover.css'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon, type IconToneToken } from '../../design-system/icons'
import type { SemanticIconName } from '../../design-system/icons/iconRegistry'
import { setActiveHintPopoverId, subscribeHintPopover } from './hintPopoverRegistry'

export type LunaHintPopoverProps = {
  title: string
  body: string
  ariaLabel?: string
  bodyMono?: boolean
  icon?: SemanticIconName
  iconTone?: IconToneToken
  triggerClassName?: string
  onOpenChange?: (open: boolean) => void
  resolvePortalRoot?: () => HTMLElement
}

type PanelPosition = {
  top: number
  left: number
}

const PANEL_GAP = 6
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function defaultPortalRoot(): HTMLElement {
  return document.body
}

export function LunaHintPopover({
  title,
  body,
  ariaLabel,
  bodyMono = false,
  icon = 'help-circle',
  iconTone = 'muted',
  triggerClassName,
  onOpenChange,
  resolvePortalRoot = defaultPortalRoot,
}: LunaHintPopoverProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const popoverId = useId()
  const instanceId = useId()
  const label = ariaLabel ?? title

  useEffect(() => {
    return subscribeHintPopover((activeId) => {
      if (activeId !== instanceId) setOpen(false)
    })
  }, [instanceId])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return

      const triggerRect = trigger.getBoundingClientRect()
      const panelWidth = panel.offsetWidth
      const panelHeight = panel.offsetHeight

      let top = triggerRect.bottom + PANEL_GAP
      if (top + panelHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = triggerRect.top - panelHeight - PANEL_GAP
      }
      top = clamp(top, VIEWPORT_PADDING, window.innerHeight - panelHeight - VIEWPORT_PADDING)

      let left = triggerRect.left
      if (left + panelWidth > window.innerWidth - VIEWPORT_PADDING) {
        left = triggerRect.right - panelWidth
      }
      left = clamp(left, VIEWPORT_PADDING, window.innerWidth - panelWidth - VIEWPORT_PADDING)

      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, body, title])

  const closeOpen = useCallback(() => {
    setOpen(false)
    setActiveHintPopoverId(null)
    triggerRef.current?.focus()
    onOpenChange?.(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeOpen()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOpen()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeyDown, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, closeOpen])

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current
      setActiveHintPopoverId(next ? instanceId : null)
      if (!next) triggerRef.current?.focus()
      onOpenChange?.(next)
      return next
    })
  }

  const panelStyle: CSSProperties | undefined = position
    ? { top: position.top, left: position.left, visibility: 'visible' }
    : { top: -9999, left: -9999, visibility: 'hidden' }

  return (
    <span className="luna-hint-popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={['luna-hint-popover-trigger', triggerClassName].filter(Boolean).join(' ')}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          toggleOpen()
        }}
      >
        <Icon name={icon} size="sm" tone={iconTone} />
      </button>
      {open
        ? createPortal(
            <div
              id={popoverId}
              ref={panelRef}
              className="luna-hint-popover-panel luna-hint-popover-panel--fixed"
              role="dialog"
              aria-modal="false"
              aria-label={title}
              style={panelStyle}
            >
              <span className="luna-hint-popover-title">{title}</span>
              <span
                className={
                  bodyMono
                    ? 'luna-hint-popover-body luna-hint-popover-body--mono'
                    : 'luna-hint-popover-body'
                }
              >
                {body}
              </span>
            </div>,
            resolvePortalRoot(),
          )
        : null}
    </span>
  )
}
