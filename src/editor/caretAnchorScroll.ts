/**
 * Caret Anchor Scroll: overlay visual calibration on top of coordsAtPos,
 * Disable scrollRatio/container ratio blind scrolling and scrollIntoView.
 *
 * Scroll strategy: First adjust the document scrolling container of the current mode (CodeMirror `scrollDOM` / ProseMirror root),
 * Then use the window formula to add a separate layer when "the whole page is scrollable" to avoid drifting caused by mixing with the center of the row.
 */

import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

import { getVisualCorrection } from './visualAnchorCalibration'
import { flashCodeMirrorNavigationJump } from './cmNavigationJumpFlash'

export { getVisualCorrection } from './visualAnchorCalibration'

export const CARET_ANCHOR_VIEWPORT_FRACTION = 0.35

/** Outline/Anchor jump: slightly below center, visually aligned with row highlight + cursor pulse*/
export const NAV_JUMP_VIEWPORT_FRACTION = 0.42

/**
 * Adjust the scrollTop of `scroller` so that the center of the cursor line (`(top+bottom)/2`) is the anchor point after visual correction
 * Falling at the `anchorFraction` from top to bottom of the scroller's visible area (the same set of anchor semantics as the window branch).
 */
export function scrollScrollerToVisualCaretAnchor(
  scroller: HTMLElement,
  coords: { top: number; bottom: number },
  calibrationEl: HTMLElement,
  anchorFraction: number = CARET_ANCHOR_VIEWPORT_FRACTION,
): void {
  if (!(scroller.isConnected && scroller.clientHeight > 0)) return
  const correction = getVisualCorrection(calibrationEl)
  const caretLineCenterY = (coords.top + coords.bottom) / 2
  const anchorViewportY = caretLineCenterY - correction
  const sr = scroller.getBoundingClientRect()
  const targetViewportY = sr.top + sr.height * anchorFraction
  const delta = anchorViewportY - targetViewportY
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  scroller.scrollTop = Math.max(0, Math.min(max, scroller.scrollTop + delta))
}

/**
 * `coords.top + window.scrollY - innerHeight * fraction - visualCorrection`, clamp to the scrollable range.
 * Skip when the entire page is almost unscrollable to avoid meaningless changes to window.scrollY in locked layout.
 */
export function scrollWindowToVisualCaretAnchor(
  coords: { top: number; bottom: number },
  calibrationEl: HTMLElement,
  anchorFraction: number = CARET_ANCHOR_VIEWPORT_FRACTION,
): void {
  if (typeof window === 'undefined') return
  const vh = window.innerHeight
  if (!(vh > 0)) return
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh)
  if (maxScroll <= 1) return

  const correction = getVisualCorrection(calibrationEl)
  const caretLineCenterY = (coords.top + coords.bottom) / 2
  const finalY = caretLineCenterY + window.scrollY - vh * anchorFraction - correction
  window.scrollTo({
    top: Math.max(0, Math.min(maxScroll, finalY)),
    left: window.scrollX,
    behavior: 'auto',
  })
}

export type CaretAnchorScrollResult =
  | { ok: true }
  | { ok: false; reason: 'no_coords' }

/**
 * CodeMirror: Called after selection has been written; `docPos` must coincide with the visible cursor (usually `selection.main.head`).
 */
export function applyCodeMirrorCaretAnchorScroll(args: {
  view: EditorView
  scrollDOM: HTMLElement
  docPos: number
  calibrationEl: HTMLElement
  /**
   * When the mode switches to the source code, CM's `scrollDOM` has assumed the main scrolling; changing `window.scrollY` again can easily overlap with the first frame reflow.
   * The performance is as follows: the relative cursor of the viewport "moves up about one line as a whole".
   */
  includeWindowScroll?: boolean
}): CaretAnchorScrollResult {
  const { view, scrollDOM, docPos, calibrationEl, includeWindowScroll = true } = args
  const coords = view.coordsAtPos(docPos)
  if (!coords) {
    scrollCodeMirrorToLineBlock(view, docPos)
    return { ok: true }
  }
  scrollScrollerToVisualCaretAnchor(scrollDOM, coords, calibrationEl)
  if (includeWindowScroll) {
    const coords2 = view.coordsAtPos(docPos)
    if (coords2) {
      scrollWindowToVisualCaretAnchor(coords2, calibrationEl)
    } else {
      scrollWindowToVisualCaretAnchor(coords, calibrationEl)
    }
  }
  return { ok: true }
}

export type ScrollCodeMirrorViewOptions = {
  /** Default true: write to selection*/
  select?: boolean
  /** Default true: focus after measure*/
  focus?: boolean
  /** Pulse cursor after jump completed (outline/anchor reveal)*/
  flash?: boolean
  /** Viewport anchor point (0=top, 1=bottom); use 0.35 for default mode switching and 0.42 for outline jump*/
  anchorFraction?: number
  /** Only lineBlock scrolling, no coords fine-tuning (to avoid superimposed offset with outline flashing)*/
  lineBlockOnly?: boolean
}

/**
 * Set scrollTop directly with `lineBlockAt` (heightmap).
 * More reliable than `coordsAtPos`: coords is null when the DOM is not rendered for lines outside the viewport, but lineBlock is always available.
 */
export function scrollCodeMirrorToLineBlock(
  view: EditorView,
  docPos: number,
  anchorFraction: number = CARET_ANCHOR_VIEWPORT_FRACTION,
): boolean {
  const scroller = view.scrollDOM
  if (!(scroller.isConnected && scroller.clientHeight > 0)) return false
  const block = view.lineBlockAt(docPos)
  const correction = getVisualCorrection(view.contentDOM as HTMLElement)
  const lineCenter = block.top + block.height / 2
  const targetScroll = lineCenter - scroller.clientHeight * anchorFraction - correction
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  scroller.scrollTop = Math.max(0, Math.min(max, targetScroll))
  return true
}

function scrollCodeMirrorViewOnce(
  view: EditorView,
  docPos: number,
  options?: Pick<ScrollCodeMirrorViewOptions, 'select' | 'anchorFraction' | 'lineBlockOnly'>,
): void {
  const select = options?.select !== false
  const anchor = options?.anchorFraction ?? CARET_ANCHOR_VIEWPORT_FRACTION
  const lineBlockOnly = options?.lineBlockOnly === true
  const pos = Math.max(0, Math.min(docPos, view.state.doc.length))
  if (select) {
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    })
  } else {
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
  }
  scrollCodeMirrorToLineBlock(view, pos, anchor)
  if (!lineBlockOnly) {
    applyCodeMirrorCaretAnchorScroll({
      view,
      scrollDOM: view.scrollDOM,
      docPos: pos,
      calibrationEl: view.contentDOM as HTMLElement,
      includeWindowScroll: false,
    })
  }
}

/**
 * Scroll the CodeMirror viewport to `docPos` (in line with the visible cursor).
 * It must be scrolled after the layout is ready: use `requestMeasure` + lineBlock to avoid `coordsAtPos` being null outside the viewport.
 */
export function scrollCodeMirrorViewToPos(
  view: EditorView,
  docPos: number,
  options?: ScrollCodeMirrorViewOptions,
): void {
  const focus = options?.focus !== false
  const flash = options?.flash === true
  const anchor = options?.anchorFraction ?? (flash ? NAV_JUMP_VIEWPORT_FRACTION : CARET_ANCHOR_VIEWPORT_FRACTION)
  const lineBlockOnly = options?.lineBlockOnly ?? flash
  const pos = Math.max(0, Math.min(docPos, view.state.doc.length))
  const onceOptions = { ...options, anchorFraction: anchor, lineBlockOnly }

  if (flash) {
    scrollCodeMirrorViewOnce(view, pos, onceOptions)
    if (focus) {
      try {
        view.focus()
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      const head = view.state.selection.main.head
      scrollCodeMirrorToLineBlock(view, head, anchor)
      flashCodeMirrorNavigationJump(view, head)
    })
    return
  }

  view.requestMeasure({
    read() {
      return pos
    },
    write(measurePos, v) {
      scrollCodeMirrorViewOnce(v, measurePos, onceOptions)
      if (focus) {
        try {
          v.focus()
        } catch {
          /* ignore */
        }
      }
    },
  })

  requestAnimationFrame(() => {
    view.requestMeasure({
      read: () => view.state.selection.main.head,
      write(head, v) {
        scrollCodeMirrorToLineBlock(v, head, anchor)
        if (focus) {
          try {
            v.focus()
          } catch {
            /* ignore */
          }
        }
      },
    })
  })
}

/** 1-based line number → viewport scrolling (outline jump, anchor reveal, etc.)*/
export function scrollCodeMirrorViewToLine(
  view: EditorView,
  line1Based: number,
  options?: ScrollCodeMirrorViewOptions,
): boolean {
  try {
    const line = view.state.doc.line(Math.min(Math.max(1, line1Based), view.state.doc.lines))
    scrollCodeMirrorViewToPos(view, line.from, { flash: true, ...options })
    return true
  } catch {
    return false
  }
}

export type PmCoordsAtPos = (pos: number) => { top: number; bottom: number } | null

/**
 * ProseMirror: `scrollerEl` and `calibrationEl` are usually the same `.ProseMirror` root (inherit row height, etc.).
 */
export function applyProseMirrorCaretAnchorScroll(args: {
  coordsAtPos: PmCoordsAtPos
  scrollerEl: HTMLElement
  calibrationEl: HTMLElement
  headPos: number
  anchorFraction?: number
  /** When the mode switches to Visual, you can scroll from the PM root. Change `window.scrollY` to easily overlap with focus/layout to the bottom.*/
  includeWindowScroll?: boolean
}): CaretAnchorScrollResult {
  const {
    coordsAtPos,
    scrollerEl,
    calibrationEl,
    headPos,
    anchorFraction = CARET_ANCHOR_VIEWPORT_FRACTION,
    includeWindowScroll = true,
  } = args
  const coords = coordsAtPos(headPos)
  if (!coords) {
    return { ok: false, reason: 'no_coords' }
  }
  scrollScrollerToVisualCaretAnchor(scrollerEl, coords, calibrationEl, anchorFraction)
  if (includeWindowScroll) {
    const coords2 = coordsAtPos(headPos)
    if (coords2) {
      scrollWindowToVisualCaretAnchor(coords2, calibrationEl, anchorFraction)
    } else {
      scrollWindowToVisualCaretAnchor(coords, calibrationEl, anchorFraction)
    }
  }
  return { ok: true }
}
