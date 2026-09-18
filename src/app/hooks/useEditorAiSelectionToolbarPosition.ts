import { useLayoutEffect, useState, type RefObject } from 'react'
import type { EditorView } from '@tiptap/pm/view'

import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { readTiptapEditorView } from '../../editor/readTiptapEditorView'
import { collectEditorScrollTargets } from './collectEditorScrollTargets'

const TOOLBAR_HEIGHT = 34
const TOOLBAR_MARGIN = 8
/** Used only before the toolbar DOM is measured on first paint. */
const TOOLBAR_FALLBACK_WIDTH = 240
const TOOLBAR_EDGE_INSET = 8

export type SelectionToolbarPosition = {
  left: number
  top: number
  placement: 'above' | 'below'
}

function selectionToolbarPositionEqual(
  prev: SelectionToolbarPosition | null,
  next: SelectionToolbarPosition | null,
): boolean {
  if (prev === next) return true
  if (!prev || !next) return false
  return prev.left === next.left && prev.top === next.top && prev.placement === next.placement
}

export function computeSelectionToolbarLeft(
  centerX: number,
  shellRect: DOMRectReadOnly,
  toolbarWidth: number,
): number {
  const width = toolbarWidth > 0 ? toolbarWidth : TOOLBAR_FALLBACK_WIDTH
  return Math.max(
    TOOLBAR_EDGE_INSET,
    Math.min(
      centerX - shellRect.left - width / 2,
      shellRect.width - width - TOOLBAR_EDGE_INSET,
    ),
  )
}

export function computeSelectionToolbarPosition(
  view: EditorView,
  shell: HTMLElement,
  toolbarWidth: number,
): SelectionToolbarPosition | null {
  const { from, to } = view.state.selection
  if (from === to) return null

  const shellRect = shell.getBoundingClientRect()
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  const caretTop = Math.min(start.top, end.top)
  const caretBottom = Math.max(start.bottom, end.bottom)
  const centerX = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2
  const left = computeSelectionToolbarLeft(centerX, shellRect, toolbarWidth)

  const spaceAbove = caretTop - shellRect.top - TOOLBAR_MARGIN
  if (spaceAbove >= TOOLBAR_HEIGHT + TOOLBAR_MARGIN) {
    return {
      left,
      top: caretTop - shellRect.top - TOOLBAR_HEIGHT - TOOLBAR_MARGIN,
      placement: 'above',
    }
  }

  return {
    left,
    top: caretBottom - shellRect.top + TOOLBAR_MARGIN,
    placement: 'below',
  }
}

export function useEditorAiSelectionToolbarPosition(
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>,
  shellRef: RefObject<HTMLElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
  visible: boolean,
  selectionTick: number,
): SelectionToolbarPosition | null {
  const [position, setPosition] = useState<SelectionToolbarPosition | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null)
      return
    }

    let disposed = false
    let unbindScroll: (() => void) | null = null
    let remeasureFrame = 0

    const readToolbarWidth = () => toolbarRef.current?.offsetWidth ?? 0

    const updatePosition = () => {
      const editor = visualEditorRef.current?.getEditor()
      const shell = shellRef.current
      const view = readTiptapEditorView(editor)
      if (!view || !shell) {
        setPosition(null)
        return
      }

      const toolbarWidth = readToolbarWidth()
      const next = computeSelectionToolbarPosition(view, shell, toolbarWidth)
      setPosition((prev) => (selectionToolbarPositionEqual(prev, next) ? prev : next))

      if (toolbarWidth === 0) {
        remeasureFrame = window.requestAnimationFrame(() => {
          remeasureFrame = 0
          if (!disposed) updatePosition()
        })
      }
    }

    const bindWhenReady = () => {
      if (disposed) return

      const editor = visualEditorRef.current?.getEditor()
      const shell = shellRef.current
      const view = readTiptapEditorView(editor)
      const editorDom = view?.dom
      if (!editor || !view || !editorDom || !shell) {
        window.requestAnimationFrame(bindWhenReady)
        return
      }
      if (unbindScroll) return

      updatePosition()

      const onScroll = () => {
        updatePosition()
      }
      const scrollTargets = collectEditorScrollTargets(shell, editorDom)
      for (const el of scrollTargets) {
        el.addEventListener('scroll', onScroll, { passive: true })
      }
      unbindScroll = () => {
        for (const el of scrollTargets) {
          el.removeEventListener('scroll', onScroll)
        }
      }
    }

    const onResize = () => {
      updatePosition()
    }

    window.addEventListener('resize', onResize, { passive: true })
    bindWhenReady()

    return () => {
      disposed = true
      if (remeasureFrame) {
        window.cancelAnimationFrame(remeasureFrame)
      }
      window.removeEventListener('resize', onResize)
      unbindScroll?.()
      unbindScroll = null
    }
  }, [visible, selectionTick, shellRef, toolbarRef, visualEditorRef])

  return position
}
