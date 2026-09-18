import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { Icon } from '../../design-system/icons'
import { useI18n, type TranslateFn } from '../../i18n'
import {
  isEditorAiSelectionToListActionId,
  requestEditorAiSelectionAction,
  type EditorAiSelectionActionId,
  type EditorAiSelectionToListActionId,
} from '../../editor/ai/editorAiActions'
import {
  getEditorAiCursorInsertRequestKey,
  isEditorAiCursorInsertRunning,
  stopEditorAiCursorInsert,
  subscribeEditorAiCursorInsert,
} from '../../editor/ai/editorAiCursorInsert'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { useEditorAiSelectionToolbarPosition } from '../hooks/useEditorAiSelectionToolbarPosition'
import { EditorAiSelectionToListDropdown } from './EditorAiSelectionToListDropdown'

type Props = {
  t: TranslateFn
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  shellRef: RefObject<HTMLElement | null>
  visible: boolean
  selectionTick: number
}

const ACTIONS: readonly {
  id: Exclude<EditorAiSelectionActionId, EditorAiSelectionToListActionId>
  labelKey: string
  icon: 'ai' | 'editor' | 'language' | 'help-circle'
}[] = [
  { id: 'ask-selection', labelKey: 'editor.aiSelection.explain', icon: 'ai' },
  { id: 'edit-selection', labelKey: 'editor.aiSelection.improve', icon: 'editor' },
  { id: 'translate-selection', labelKey: 'editor.aiSelection.translate', icon: 'language' },
  { id: 'grammar-check', labelKey: 'editor.aiSelection.grammar', icon: 'help-circle' },
]

const TO_LIST_INSERT_INDEX = 2

export function EditorAiSelectionToolbar({
  t,
  visualEditorRef,
  shellRef,
  visible,
  selectionTick,
}: Props) {
  const { effectiveLocale } = useI18n()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [iconOnly, setIconOnly] = useState(false)
  const [runningActionId, setRunningActionId] = useState<EditorAiSelectionActionId | null>(null)
  const [toolbarHasFocus, setToolbarHasFocus] = useState(false)
  const position = useEditorAiSelectionToolbarPosition(
    visualEditorRef,
    shellRef,
    toolbarRef,
    visible,
    selectionTick,
  )

  const handleAction = useCallback(
    (actionId: EditorAiSelectionActionId) => {
      requestEditorAiSelectionAction(actionId, t, effectiveLocale)
    },
    [effectiveLocale, t],
  )

  useEffect(() => {
    const syncRunning = () => {
      const isRunning = isEditorAiCursorInsertRunning()
      if (!isRunning) {
        setRunningActionId(null)
        return
      }
      const requestKey = getEditorAiCursorInsertRequestKey()
      if (
        requestKey === 'ask-selection' ||
        requestKey === 'edit-selection' ||
        isEditorAiSelectionToListActionId(requestKey) ||
        requestKey === 'translate-selection' ||
        requestKey === 'grammar-check'
      ) {
        setRunningActionId(requestKey)
        return
      }
      setRunningActionId(null)
    }
    syncRunning()
    return subscribeEditorAiCursorInsert(syncRunning)
  }, [])

  useLayoutEffect(() => {
    if (!visible || !position) {
      setIconOnly(false)
      return
    }

    let cancelled = false
    const measure = () => {
      if (cancelled) return
      const toolbar = toolbarRef.current
      const shell = shellRef.current
      if (!toolbar || !shell) {
        setIconOnly(false)
        return
      }
      const availableWidth = shell.clientWidth - 16
      const needsIconOnly = toolbar.scrollWidth > availableWidth
      setIconOnly((prev) => (prev === needsIconOnly ? prev : needsIconOnly))
    }

    measure()
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- position fields only; whole object gets new reference each scroll frame
  }, [visible, position?.left, position?.placement, position?.top, selectionTick, shellRef])

  useEffect(() => {
    if (!visible) {
      setActiveIndex(0)
      setToolbarHasFocus(false)
    }
  }, [visible, selectionTick])

  useEffect(() => {
    if (!visible || !position) return

    const onKey = (event: KeyboardEvent) => {
      if (!toolbarRef.current?.contains(document.activeElement)) return

      if (event.key === 'Escape') {
        visualEditorRef.current?.getEditor()?.commands.focus()
        return
      }

      const buttons = toolbarRef.current
        ? [...toolbarRef.current.querySelectorAll<HTMLButtonElement>('.editor-ai-selection-toolbar-btn:not([disabled])')]
        : []
      if (buttons.length === 0) return

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => {
          const next = (index + 1) % buttons.length
          buttons[next]?.focus({ preventScroll: true })
          return next
        })
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => {
          const next = (index - 1 + buttons.length) % buttons.length
          buttons[next]?.focus({ preventScroll: true })
          return next
        })
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const active = document.activeElement
        const button =
          active instanceof HTMLButtonElement && toolbarRef.current?.contains(active)
            ? active
            : buttons[activeIndex]
        button?.click()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- position fields only; whole object unstable
  }, [activeIndex, position?.left, position?.placement, position?.top, visible, visualEditorRef])

  if (!visible || !position) return null

  const toolbarBusy = runningActionId !== null
  const toListBusy = isEditorAiSelectionToListActionId(runningActionId)

  const renderActionButton = (
    action: (typeof ACTIONS)[number],
    index: number,
  ) => {
    const busy = action.id === runningActionId && toolbarBusy
    const label = busy ? t('editor.aiAction.working') : t(action.labelKey)
    const showActiveState = toolbarHasFocus && index === activeIndex
    return (
      <button
        key={action.id}
        type="button"
        className={`editor-ai-selection-toolbar-btn${showActiveState ? ' editor-ai-selection-toolbar-btn--active' : ''}${busy ? ' editor-ai-selection-toolbar-btn--busy' : ''}`}
        onClick={() => {
          if (busy) {
            stopEditorAiCursorInsert()
            return
          }
          handleAction(action.id)
        }}
        data-testid={`editor-ai-selection-${action.id}`}
        data-toolbar-active={showActiveState ? 'true' : 'false'}
        data-busy={busy ? 'true' : 'false'}
        title={iconOnly ? label : undefined}
        aria-label={label}
        disabled={toolbarBusy && !busy}
        tabIndex={index === activeIndex ? 0 : -1}
        onMouseEnter={() => setActiveIndex(index)}
        onFocus={() => {
          setToolbarHasFocus(true)
          setActiveIndex(index)
        }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget
          if (nextTarget instanceof Node && toolbarRef.current?.contains(nextTarget)) return
          setToolbarHasFocus(false)
        }}
      >
        <Icon name={action.icon} size="xs" stroke="strong" />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div
      ref={toolbarRef}
      className={`editor-ai-selection-toolbar editor-ai-selection-toolbar--${position.placement}${iconOnly ? ' editor-ai-selection-toolbar--icon-only' : ''}`}
      style={{ left: position.left, top: position.top }}
      role="toolbar"
      aria-label={t('editor.aiSelection.aria')}
      aria-busy={toolbarBusy}
      data-testid="editor-ai-selection-toolbar"
      onMouseDown={(event) => {
        event.preventDefault()
      }}
    >
      {ACTIONS.slice(0, TO_LIST_INSERT_INDEX).map((action, index) => renderActionButton(action, index))}
      <EditorAiSelectionToListDropdown
        t={t}
        iconOnly={iconOnly}
        busy={toListBusy}
        disabled={toolbarBusy && !toListBusy}
        showActiveState={toolbarHasFocus && activeIndex === TO_LIST_INSERT_INDEX}
        tabIndex={activeIndex === TO_LIST_INSERT_INDEX ? 0 : -1}
        onAction={handleAction}
        onMouseEnter={() => setActiveIndex(TO_LIST_INSERT_INDEX)}
        onFocus={() => {
          setToolbarHasFocus(true)
          setActiveIndex(TO_LIST_INSERT_INDEX)
        }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget
          if (nextTarget instanceof Node && toolbarRef.current?.contains(nextTarget)) return
          setToolbarHasFocus(false)
        }}
      />
      {ACTIONS.slice(TO_LIST_INSERT_INDEX).map((action, index) =>
        renderActionButton(action, TO_LIST_INSERT_INDEX + 1 + index),
      )}
    </div>
  )
}
