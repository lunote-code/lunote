import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../../design-system/icons'
import { clampMenuElementPosition } from '../../lib/contextMenuPosition'
import type { TranslateFn } from '../../i18n'
import type { ToolbarCommandDef } from '../../menu/menu.types'
import { resolveMenuCommandSemanticIcon } from '../../menu/menuSemanticIcons'
import { resolveEditorFormatToolbarIcon } from './editorFormatToolbarIcons'

type Props = {
  t: TranslateFn
  label: string
  title: string
  items: ToolbarCommandDef[]
  onCommand: (commandId: string) => void
  onOpenChange?: (open: boolean) => void
}

export function EditorCalloutToolbarDropdown({ t, label, title, items, onCommand, onOpenChange }: Props) {
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    left: -9999,
    top: 0,
  })

  const closePanel = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle({ visibility: 'hidden', left: -9999, top: 0 })
      return
    }

    let frame = 0
    const position = () => {
      const anchor = triggerRef.current
      const panel = panelRef.current
      if (!anchor || !panel) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const preferredLeft = anchorRect.left
      const preferredTop = anchorRect.bottom + 4
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const { x: left, y: top } = clampMenuElementPosition(panel, preferredLeft, preferredTop)
      setPanelStyle({
        left,
        top,
        visibility: 'visible',
        minWidth: Math.max(200, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [open, items.length])

  useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      closePanel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, closePanel])

  const triggerIcon = resolveEditorFormatToolbarIcon('toolbar-callout') ?? 'callout'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="editor-format-btn editor-format-btn--callout"
        title={title}
        aria-label={t('editor.format.callout.toolbarAria')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={triggerIcon} className="editor-format-btn-icon" size="sm" stroke="strong" />
        <Icon name="chevron-down" className="editor-format-callout-chevron" size="sm" stroke="strong" />
        <span className="sr-only">{label}</span>
      </button>
      {typeof document !== 'undefined' &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            className="editor-format-callout-menu"
            style={panelStyle}
            role="menu"
            aria-label={t('editor.format.callout.menuAria')}
          >
            {items.map((item) => {
              const iconName = resolveMenuCommandSemanticIcon(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className="editor-format-callout-menu-item"
                  role="menuitem"
                  title={item.shortcut ? `${item.title} (${item.shortcut})` : item.title}
                  onClick={() => {
                    closePanel()
                    onCommand(item.id)
                  }}
                >
                  {iconName ? (
                    <Icon name={iconName} className="editor-format-callout-menu-icon" size="sm" stroke="strong" />
                  ) : null}
                  <span className="editor-format-callout-menu-label">{item.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
