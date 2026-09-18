import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon, type SemanticIconName } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { clampMenuElementPosition } from '../../lib/contextMenuPosition'
import { useFocusTrap } from '../../lib/useFocusTrap'
import type { EditorAiSelectionToListActionId } from '../../editor/ai/editorAiActions'
import { stopEditorAiCursorInsert } from '../../editor/ai/editorAiCursorInsert'

const ITEMS: readonly {
  id: EditorAiSelectionToListActionId
  labelKey: string
  icon: SemanticIconName
}[] = [
  { id: 'selection-to-bullet-list', labelKey: 'editor.aiSelection.toList.bullet', icon: 'list' },
  { id: 'selection-to-ordered-list', labelKey: 'editor.aiSelection.toList.ordered', icon: 'list-ordered' },
  { id: 'selection-to-task-list', labelKey: 'editor.aiSelection.toList.task', icon: 'task' },
]

type Props = {
  t: TranslateFn
  iconOnly: boolean
  busy: boolean
  disabled: boolean
  showActiveState: boolean
  tabIndex: number
  onAction: (actionId: EditorAiSelectionToListActionId) => void
  onFocus: () => void
  onBlur: (event: FocusEvent<HTMLButtonElement>) => void
  onMouseEnter: () => void
}

export function EditorAiSelectionToListDropdown({
  t,
  iconOnly,
  busy,
  disabled,
  showActiveState,
  tabIndex,
  onAction,
  onFocus,
  onBlur,
  onMouseEnter,
}: Props) {
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    left: -9999,
    top: 0,
  })

  const closePanel = useCallback(() => setOpen(false), [])
  const label = busy ? t('editor.aiAction.working') : t('editor.aiSelection.toList')

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
        minWidth: Math.max(168, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [open])

  useFocusTrap(open, panelEl, {
    onEscape: closePanel,
  })

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (event: MouseEvent) => {
      if (event.button === 2) return
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      closePanel()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [open, closePanel])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`editor-ai-selection-toolbar-btn editor-ai-selection-toolbar-btn--dropdown${showActiveState ? ' editor-ai-selection-toolbar-btn--active' : ''}${busy ? ' editor-ai-selection-toolbar-btn--busy' : ''}`}
        data-testid="editor-ai-selection-to-list-trigger"
        data-toolbar-active={showActiveState ? 'true' : 'false'}
        data-busy={busy ? 'true' : 'false'}
        title={iconOnly ? label : undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled && !busy}
        tabIndex={tabIndex}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={() => {
          if (busy) {
            stopEditorAiCursorInsert()
            return
          }
          setOpen((value) => !value)
        }}
      >
        <Icon name="list" size="xs" stroke="strong" />
        {!iconOnly ? <span>{label}</span> : null}
        <Icon name="chevron-down" className="editor-ai-selection-toolbar-chevron" size="xs" stroke="strong" />
      </button>
      {typeof document !== 'undefined' &&
        open &&
        createPortal(
          <div
            ref={(node) => {
              panelRef.current = node
              setPanelEl(node)
            }}
            id={menuId}
            className="editor-ai-selection-toolbar-menu"
            style={panelStyle}
            role="menu"
            aria-label={t('editor.aiSelection.toList.menuAria')}
          >
            {ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="editor-ai-selection-toolbar-menu-item"
                role="menuitem"
                data-testid={`editor-ai-selection-${item.id}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  closePanel()
                  onAction(item.id)
                }}
              >
                <Icon name={item.icon} size="xs" stroke="strong" />
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
