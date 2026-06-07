import type { EditorView } from '@codemirror/view'
import type { Editor } from '@tiptap/core'

import { activateNativeInput, findNativeInputForTarget } from '../../documentRuntime/nativeInput'
import { isCodeBlockCmMouseTarget } from './codeBlockCmDom'
import { focusCodeBlockCmView } from './codeBlockCmFocus'
import { debugCodeBlockCmFocus, describeDomTarget } from './codeBlockCmFocusDebug'
import { disablePmCodeBlockMirrorEditing } from './codeBlockCmPmMirror'

export type CodeBlockCmInputFocusHandlers = {
  getCmView: () => EditorView | null
  onActivateEditing: () => void
  editor?: Editor
  /** Capture CM selection before Chromium collapses it on right-click. */
  onRightMouseDownPreserveSelection?: (view: EditorView) => void
}

export type AcquireCodeBlockCmFocusOpts = {
  pmDom?: HTMLElement | null
  nativeInputId?: string | null
  wrap?: HTMLElement | null
}

/**
 * Solution B — single synchronous path to focus CM (PM dom suspend is owned by lock/unlock).
 */
export function acquireCodeBlockCmFocus(
  cmView: EditorView,
  opts?: AcquireCodeBlockCmFocusOpts,
): boolean {
  if (opts?.wrap) disablePmCodeBlockMirrorEditing(opts.wrap)
  const ok = focusCodeBlockCmView(cmView, { pmDom: opts?.pmDom ?? undefined })
  if (ok && opts?.nativeInputId) activateNativeInput(opts.nativeInputId)
  debugCodeBlockCmFocus('kernel-acquire-focus', {
    ok,
    cmHasFocus: cmView.hasFocus,
    nativeInputId: opts?.nativeInputId ?? undefined,
    activeElement: describeDomTarget(document.activeElement),
  })
  return ok
}

function correctCmPosForLineEndSlop(
  view: EditorView,
  x: number,
  docY: number,
  pos: number,
  contentRect: DOMRect,
): number {
  const doc = view.state.doc
  const line = doc.lineAt(pos)
  const lineBlock = view.lineBlockAt(line.from)

  if (line.number > 1 && pos === line.from) {
    const prevLine = doc.line(line.number - 1)
    const prevBlock = view.lineBlockAt(prevLine.from)
    const inGapBelowPrev = docY >= prevBlock.bottom - 4 && docY <= lineBlock.top + 6
    const nearContentRight = x >= contentRect.right - 28
    if (inGapBelowPrev && nearContentRight) return prevLine.to
  }

  if (line.number < doc.lines && pos >= line.to) {
    const nextLine = doc.line(line.number + 1)
    if (pos === nextLine.from && docY <= lineBlock.bottom + 4 && x >= contentRect.left - 1) {
      return line.to
    }
  }

  return pos
}

/** When posAtCoords misses (pointer in inter-line slop), resolve from line blocks. */
function resolveCodeBlockCmPosFromLineBlocks(
  view: EditorView,
  x: number,
  docY: number,
  contentRect: DOMRect,
): number | null {
  const doc = view.state.doc
  const clamp = (pos: number) => Math.max(0, Math.min(pos, doc.length))
  const scrollerRect = view.scrollDOM.getBoundingClientRect()

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const block = view.lineBlockAt(line.from)
    const inBand = docY >= block.top - 2 && docY <= block.bottom + 6
    if (!inBand) continue

    const inBottomSlop = docY >= block.bottom - 4
    const nearLineEndX = x >= contentRect.right - 28 && x <= contentRect.right + 2
    if (inBottomSlop && nearLineEndX) return clamp(line.to)

    const midY = scrollerRect.top + block.top + (block.bottom - block.top) / 2
    const midPos = view.posAtCoords({ x, y: midY })
    if (midPos != null) return clamp(midPos)
    return clamp(line.to)
  }

  return null
}

/**
 * Resolve a document position from screen coords when precise hit-testing misses (e.g. last line / bottom pad).
 */
export function resolveCodeBlockCmPosFromMouse(view: EditorView, x: number, y: number): number {
  const coords = { x, y }
  const doc = view.state.doc
  const clamp = (pos: number) => Math.max(0, Math.min(pos, doc.length))

  const scroller = view.scrollDOM
  const bounds = scroller.getBoundingClientRect()
  const docY = y - bounds.top + scroller.scrollTop
  const contentRect = view.contentDOM.getBoundingClientRect()

  const readPos = (): number | null => {
    const precise = view.posAtCoords(coords)
    if (precise != null) return precise
    const side = view.posAndSideAtCoords(coords)
    if (side != null) return side.pos
    const impreciseSide = view.posAndSideAtCoords(coords, false)
    if (impreciseSide != null) return impreciseSide.pos
    return view.posAtCoords(coords, false)
  }

  let pos = readPos()
  if (pos != null) {
    pos = correctCmPosForLineEndSlop(view, x, docY, clamp(pos), contentRect)
    return clamp(pos)
  }

  const fromBlocks = resolveCodeBlockCmPosFromLineBlocks(view, x, docY, contentRect)
  if (fromBlocks != null) {
    return correctCmPosForLineEndSlop(view, x, docY, fromBlocks, contentRect)
  }

  if (doc.lines > 0) {
    const lastLine = doc.line(doc.lines)
    const lastBlock = view.lineBlockAt(lastLine.to)
    const onLastLine = docY >= lastBlock.top - 1 && docY <= lastBlock.bottom + 8
    if (onLastLine) {
      if (docY >= lastBlock.bottom - 2 && x >= contentRect.right - 6) return doc.length
      return clamp(lastLine.to)
    }
    if (docY >= lastBlock.bottom) return doc.length
  }

  return 0
}

/**
 * Apply a CM selection range, clamped to document bounds.
 */
export function dispatchCodeBlockCmSelection(view: EditorView, anchor: number, head: number): void {
  const len = view.state.doc.length
  const a = Math.max(0, Math.min(anchor, len))
  const h = Math.max(0, Math.min(head, len))
  const sel = view.state.selection.main
  if (sel.anchor === a && sel.head === h) return
  view.dispatch({ selection: { anchor: a, head: h }, scrollIntoView: true })
}

/**
 * Map a mouse event to a CM selection (kernel uses preventDefault, so CM cannot rely on its own mousedown).
 */
export function placeCodeBlockCmSelectionFromMouse(
  view: EditorView,
  event: MouseEvent,
  opts?: { extend?: boolean },
): number {
  const pos = resolveCodeBlockCmPosFromMouse(view, event.clientX, event.clientY)
  const anchor = opts?.extend ? view.state.selection.main.anchor : pos
  dispatchCodeBlockCmSelection(view, anchor, pos)
  return pos
}

type DragSession = {
  view: EditorView
  anchor: number
  onMove: (event: MouseEvent) => void
  onUp: (event: MouseEvent) => void
}

function clearCodeBlockCmDragSession(session: DragSession | null): void {
  if (!session) return
  document.removeEventListener('mousemove', session.onMove, true)
  document.removeEventListener('mouseup', session.onUp, true)
}

/**
 * Native capture mousedown on code-block wrap — the only pointer entry for CM focus.
 * Rule: never preventDefault on pointerdown (WebKit suppresses mousedown).
 */
export function installCodeBlockCmMouseDownCapture(
  wrap: HTMLElement,
  handlers: CodeBlockCmInputFocusHandlers,
): () => void {
  let dragSession: DragSession | null = null

  const onMouseDownCapture = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !isCodeBlockCmMouseTarget(target, event.clientX, event.clientY)) return

    // Right-click must not move CM selection or focus — context menu opens separately.
    if (event.button === 2) {
      const view = handlers.getCmView()
      if (view) handlers.onRightMouseDownPreserveSelection?.(view)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.button !== 0) return

    clearCodeBlockCmDragSession(dragSession)
    dragSession = null

    event.preventDefault()
    const view = handlers.getCmView()
    if (!view) return
    handlers.onActivateEditing()
    const reg = findNativeInputForTarget(target)
    const ok = acquireCodeBlockCmFocus(view, {
      pmDom: handlers.editor?.view.dom,
      nativeInputId: reg?.id ?? null,
      wrap,
    })
    const placed = placeCodeBlockCmSelectionFromMouse(view, event, { extend: event.shiftKey })
    const dragAnchor = event.shiftKey ? view.state.selection.main.anchor : placed

    const onMove = (moveEvent: MouseEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        clearCodeBlockCmDragSession(dragSession)
        dragSession = null
        return
      }
      const head = resolveCodeBlockCmPosFromMouse(view, moveEvent.clientX, moveEvent.clientY)
      dispatchCodeBlockCmSelection(view, dragAnchor, head)
    }
    const onUp = () => {
      clearCodeBlockCmDragSession(dragSession)
      dragSession = null
    }

    dragSession = { view, anchor: dragAnchor, onMove, onUp }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)

    debugCodeBlockCmFocus('kernel-mousedown-capture', {
      cmHasFocus: view.hasFocus,
      selectionPlaced: true,
      selectionPos: placed,
      focusOk: ok,
      activeElement: describeDomTarget(document.activeElement),
      target: describeDomTarget(target),
    })
    if (!ok) {
      requestAnimationFrame(() => {
        const activeView = handlers.getCmView()
        if (!activeView) return
        if (!activeView.hasFocus) {
          acquireCodeBlockCmFocus(activeView, {
            pmDom: handlers.editor?.view.dom,
            nativeInputId: reg?.id ?? null,
            wrap,
          })
        }
        placeCodeBlockCmSelectionFromMouse(activeView, event, { extend: event.shiftKey })
      })
    }
  }

  const onContextMenuCapture = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !isCodeBlockCmMouseTarget(target, event.clientX, event.clientY)) return
    event.preventDefault()
  }

  const dispose = () => {
    clearCodeBlockCmDragSession(dragSession)
    dragSession = null
    wrap.removeEventListener('mousedown', onMouseDownCapture, true)
    wrap.removeEventListener('contextmenu', onContextMenuCapture, true)
  }
  wrap.addEventListener('mousedown', onMouseDownCapture, true)
  wrap.addEventListener('contextmenu', onContextMenuCapture, true)
  return dispose
}
