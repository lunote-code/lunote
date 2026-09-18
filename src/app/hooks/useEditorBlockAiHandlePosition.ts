import { useLayoutEffect, useState, type RefObject } from 'react'

import type { Editor } from '@tiptap/core'

import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import {
  resolveBlockAiTarget,
  resolveBlockAiPositionAnchor,
  type BlockAiTarget,
} from '../../editor/ai/editorBlockAi'
import { readTiptapEditorView } from '../../editor/readTiptapEditorView'
import { collectEditorScrollTargets } from './collectEditorScrollTargets'
import {
  isBlockFullyOutsideShellVertically,
  resolveBlockHandleLayout,
  type BlockHandlePlacement,
} from './blockAiHandleLayout'

export type BlockAiHandlePosition = {
  left: number
  top: number
  placement: BlockHandlePlacement
  target: BlockAiTarget
}

function blockAiTargetEqual(a: BlockAiTarget, b: BlockAiTarget): boolean {
  return a.blockType === b.blockType && a.from === b.from && a.to === b.to && a.pos === b.pos
}

function blockHandlePositionEqual(
  prev: BlockAiHandlePosition | null,
  next: BlockAiHandlePosition | null,
): boolean {
  if (prev === next) return true
  if (!prev || !next) return false
  return (
    prev.left === next.left &&
    prev.top === next.top &&
    prev.placement === next.placement &&
    blockAiTargetEqual(prev.target, next.target)
  )
}

function resolveBlockDom(view: NonNullable<ReturnType<typeof readTiptapEditorView>>, target: BlockAiTarget): HTMLElement | null {
  const dom = view.nodeDOM(target.pos)
  if (dom instanceof HTMLElement) return dom
  if (dom?.parentElement instanceof HTMLElement) return dom.parentElement
  return null
}

function isTargetInsideListItem(
  view: NonNullable<ReturnType<typeof readTiptapEditorView>>,
  target: BlockAiTarget,
): boolean {
  const pos = Math.min(target.from + 1, Math.max(target.from, target.to - 1))
  const $pos = view.state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const name = $pos.node(depth).type.name
    if (name === 'listItem' || name === 'taskItem') return true
  }
  return false
}

function computeBlockHandlePosition(
  editor: Editor,
  view: NonNullable<ReturnType<typeof readTiptapEditorView>>,
  shell: HTMLElement,
  target: BlockAiTarget,
): BlockAiHandlePosition | null {
  const anchor = resolveBlockAiPositionAnchor(editor, target)
  const anchorTarget: BlockAiTarget = { ...target, ...anchor }
  const shellRect = shell.getBoundingClientRect()
  const blockEl = resolveBlockDom(view, anchorTarget)
  const coords = view.coordsAtPos(Math.min(anchor.from + 1, anchor.to - 1))
  const blockRect = blockEl?.getBoundingClientRect()
  const blockTop = blockRect?.top ?? coords.top
  const blockLeft = blockRect?.left ?? coords.left

  const blockRight = blockRect?.right ?? coords.right
  const blockBottom = blockRect?.bottom ?? coords.bottom
  if (
    isBlockFullyOutsideShellVertically(
      blockTop,
      blockBottom,
      shellRect.top,
      shellRect.bottom,
    )
  ) {
    return null
  }
  const layout = resolveBlockHandleLayout({
    shellLeft: shellRect.left,
    shellTop: shellRect.top,
    shellWidth: shellRect.width,
    blockLeft,
    blockRight,
    blockTop,
    inListItem: isTargetInsideListItem(view, anchorTarget),
  })

  return { left: layout.left, top: layout.top, placement: layout.placement, target }
}

export function useEditorBlockAiHandlePosition(
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>,
  shellRef: RefObject<HTMLElement | null>,
  visible: boolean,
  revealed: boolean,
  selectionTick: number,
): BlockAiHandlePosition | null {
  const [position, setPosition] = useState<BlockAiHandlePosition | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      setPosition((prev) => (prev === null ? prev : null))
      return
    }

    let disposed = false
    let unbindScroll: (() => void) | null = null

    const updatePosition = () => {
      const editor = visualEditorRef.current?.getEditor()
      const shell = shellRef.current
      const view = readTiptapEditorView(editor)
      if (!editor || !view || !shell) {
        setPosition((prev) => (prev === null ? prev : null))
        return
      }
      const target = resolveBlockAiTarget(editor)
      if (!target) {
        setPosition((prev) => (prev === null ? prev : null))
        return
      }
      const next = computeBlockHandlePosition(editor, view, shell, target)
      setPosition((prev) => (blockHandlePositionEqual(prev, next) ? prev : next))
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

      if (!revealed) return

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
      window.removeEventListener('resize', onResize)
      unbindScroll?.()
      unbindScroll = null
    }
  }, [visible, revealed, selectionTick, shellRef, visualEditorRef])

  return position
}
