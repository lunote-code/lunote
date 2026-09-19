import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react'

import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import {
  blockAiActionLabelKey,
  listBlockAiActions,
  snapshotBlockAiTarget,
  type BlockAiActionId,
} from '../../editor/ai/editorBlockAi'
import {
  isEditorBlockAiRunning,
  requestEditorBlockAi,
  subscribeEditorBlockAi,
} from '../../editor/ai/editorBlockAiRunner'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { clampMenuElementWithinContainer } from '../../lib/contextMenuPosition'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { useEditorBlockAiHandlePosition } from '../hooks/useEditorBlockAiHandlePosition'
import { useEditorBlockAiHandleReveal } from '../hooks/useEditorBlockAiHandleReveal'
import { pushAppToast } from '../toast/appToastStore'
import {
  isBlockAiDiscoverHintSeen,
  markBlockAiDiscoverHintSeen,
} from '../blockAiHintStorage'

type Props = {
  t: TranslateFn
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  shellRef: RefObject<HTMLElement | null>
  visible: boolean
  selectionTick: number
}

export function EditorBlockAiHandle({
  t,
  visualEditorRef,
  shellRef,
  visible,
  selectionTick,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuEl, setMenuEl] = useState<HTMLDivElement | null>(null)
  const [menuClampStyle, setMenuClampStyle] = useState<CSSProperties>({})
  const [activeMenuIndex, setActiveMenuIndex] = useState(0)
  const unsupportedBlockToastShownRef = useRef(false)
  const notifyUnsupportedBlock = useCallback(() => {
    if (unsupportedBlockToastShownRef.current) return
    unsupportedBlockToastShownRef.current = true
    pushAppToast(t('editor.blockAi.unsupportedBlock'), 'info')
  }, [t])
  const { revealed, menuOpen, setMenuOpen, dismiss } = useEditorBlockAiHandleReveal(
    visualEditorRef,
    shellRef,
    visible,
    rootRef,
    selectionTick,
    notifyUnsupportedBlock,
  )
  const position = useEditorBlockAiHandlePosition(
    visualEditorRef,
    shellRef,
    visible,
    revealed,
    selectionTick,
  )
  const blockAiRunning = useSyncExternalStore(
    subscribeEditorBlockAi,
    isEditorBlockAiRunning,
    isEditorBlockAiRunning,
  )
  const menuTrapOpen = menuOpen && !blockAiRunning

  useFocusTrap(menuTrapOpen, menuEl, {
    onEscape: () => {
      dismiss()
      visualEditorRef.current?.getEditor()?.commands.focus()
    },
  })

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuClampStyle({})
      return
    }

    const clampMenu = () => {
      const menu = menuRef.current
      const shell = shellRef.current
      if (!menu || !shell) return

      const shellRect = shell.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const preferredLeft = menuRect.left - shellRect.left
      const preferredTop = menuRect.top - shellRect.top
      const { x, y } = clampMenuElementWithinContainer(menu, preferredLeft, preferredTop, {
        width: shellRect.width,
        height: shellRect.height,
      })

      const marginLeft = x - preferredLeft
      const marginTop = y - preferredTop
      setMenuClampStyle((prev) =>
        prev.marginLeft === marginLeft && prev.marginTop === marginTop
          ? prev
          : { marginLeft, marginTop },
      )
    }

    clampMenu()
    window.addEventListener('resize', clampMenu, { passive: true })
    return () => window.removeEventListener('resize', clampMenu)
  }, [menuOpen, position?.left, position?.top, position?.placement, shellRef])

  useEffect(() => {
    if (!menuOpen) setActiveMenuIndex(0)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      const items = menuRef.current
        ? [...menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')]
        : []
      if (items.length === 0) return

      // Click-open uses preventDefault on the handle, so focus can lag behind the open
      // menu. Arrow keys must still move the active item while the menu is visible.
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveMenuIndex((index) => {
          const next = (index + 1) % items.length
          items[next]?.focus({ preventScroll: true })
          return next
        })
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveMenuIndex((index) => {
          const next = (index - 1 + items.length) % items.length
          items[next]?.focus({ preventScroll: true })
          return next
        })
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const active = document.activeElement
        const item =
          active instanceof HTMLButtonElement && menuRef.current?.contains(active)
            ? active
            : items[activeMenuIndex]
        item?.click()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [activeMenuIndex, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen, setMenuOpen])

  useEffect(() => {
    if (!visible) dismiss()
  }, [dismiss, visible])

  useEffect(() => {
    if (blockAiRunning) setMenuOpen(false)
  }, [blockAiRunning, setMenuOpen])

  useEffect(() => {
    if (!revealed || isBlockAiDiscoverHintSeen()) return
    markBlockAiDiscoverHintSeen()
    pushAppToast(t('editor.blockAi.discoverHint'), 'info')
  }, [revealed, t])

  const handleAction = useCallback(
    (actionId: BlockAiActionId) => {
      if (blockAiRunning) return
      const editor = visualEditorRef.current?.getEditor()
      if (!editor || !position?.target) return
      const snapshot = snapshotBlockAiTarget(editor, position.target)
      setMenuOpen(false)
      requestEditorBlockAi(actionId, snapshot, t)
    },
    [blockAiRunning, position?.target, setMenuOpen, t, visualEditorRef],
  )

  if (!visible || !position || !revealed) return null

  if (position.target.blockType === 'codeBlock') return null

  const actions = listBlockAiActions(position.target.blockType)
  const handleLabel = blockAiRunning ? t('editor.aiAction.working') : t('editor.blockAi.handleTitle')

  return (
    <div
      ref={rootRef}
      className="editor-block-ai-handle editor-block-ai-handle--revealed"
      style={{ left: position.left, top: position.top }}
      data-testid="editor-block-ai-handle"
      data-placement={position.placement}
      data-block-type={position.target.blockType}
      data-running={blockAiRunning ? 'true' : 'false'}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
    >
      <div className="editor-block-ai-handle-row">
        <button
          type="button"
          className={`editor-block-ai-handle-btn${menuOpen ? ' editor-block-ai-handle-btn--open' : ''}${blockAiRunning ? ' editor-block-ai-handle-btn--running' : ''}`}
          aria-label={handleLabel}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-busy={blockAiRunning}
          data-testid="editor-block-ai-handle-trigger"
          title={handleLabel}
          disabled={blockAiRunning}
          onClick={() => {
            if (blockAiRunning) return
            setMenuOpen((open) => !open)
          }}
        >
          {blockAiRunning ? (
            <Icon name="refresh" size="xs" stroke="strong" className="editor-block-ai-handle-spinner" />
          ) : (
            <Icon name="ai" size="xs" stroke="strong" />
          )}
        </button>
      </div>
      {menuOpen && !blockAiRunning ? (
        <div
          ref={(node) => {
            menuRef.current = node
            setMenuEl(node)
          }}
          className="editor-block-ai-handle-menu"
          role="menu"
          aria-label={t('editor.blockAi.aria')}
          data-testid="editor-block-ai-handle-menu"
          style={menuClampStyle}
        >
          {actions.map((actionId, index) => (
            <button
              key={actionId}
              type="button"
              role="menuitem"
              tabIndex={index === activeMenuIndex ? 0 : -1}
              className={`editor-block-ai-handle-menu-item${index === activeMenuIndex ? ' editor-block-ai-handle-menu-item--active' : ''}`}
              data-testid={`editor-block-ai-${actionId}`}
              data-menu-active={index === activeMenuIndex ? 'true' : 'false'}
              onMouseEnter={() => setActiveMenuIndex(index)}
              disabled={blockAiRunning}
              onClick={() => handleAction(actionId)}
            >
              {t(blockAiActionLabelKey(actionId))}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
