import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { getTabEditorSession } from '../app/document/tabEditorSessionStore'
import { applyPmSelectionFromFrozenProjection } from './modeSwitchDocumentProjection'
import {
  logModeSwitchProjectionInspectLines,
  recordPostApplyInspection,
  recordPostViewportInspection,
  recordPreViewportInspection,
  startVisualRestoreInspection,
} from './modeSwitchProjectionInspector'
import { debugModeSwitch, describeScrollMetrics, summarizeSnapshot } from './modeSwitchDebug'
import { applyProseMirrorCaretAnchorScroll } from './caretAnchorScroll'
import {
  MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
  PRE_FOCUS_STABLE_FRAMES,
  waitLayoutStabilizationBarrier,
} from './layoutStabilization'
import type { AtomicVisualDocumentEnter } from './tiptapEditorTypes'

type VisualViewportRestoreResult = 'scroll_centered' | 'scroll_nearby' | 'scroll_skipped'

function restoreProseMirrorScrollRatio(editor: Editor, ratio: number | undefined): void {
  if (ratio == null || !Number.isFinite(ratio)) return
  if (editor.isDestroyed || !editor.view?.dom) return
  const dom = editor.view.dom as HTMLElement
  const maxScroll = dom.scrollHeight - dom.clientHeight
  if (maxScroll <= 0) return
  dom.scrollTop = Math.max(0, Math.min(1, ratio)) * maxScroll
}

export function resolveVisualTabRestore(
  documentKey: string,
  boot: AtomicVisualDocumentEnter | null,
): AtomicVisualDocumentEnter | null {
  if (
    boot &&
    boot.documentKey === documentKey &&
    Number.isFinite(boot.pmAnchor) &&
    Number.isFinite(boot.pmHead)
  ) {
    return boot
  }
  const visual = getTabEditorSession(documentKey)?.visual
  if (!visual || !Number.isFinite(visual.pmAnchor) || !Number.isFinite(visual.pmHead)) {
    return null
  }
  return {
    documentKey,
    pmAnchor: visual.pmAnchor,
    pmHead: visual.pmHead,
    scrollRatio: visual.scrollRatio,
  }
}

export function applyVisualTabViewportRestore(editor: Editor, restore: AtomicVisualDocumentEnter): void {
  if (editor.isDestroyed || !editor.view?.dom) return
  const max = editor.state.doc.content.size
  if (max < 1) return
  let restored = false
  const inspectCtx = restore.modeSwitchSnapshot
    ? startVisualRestoreInspection(editor.view, editor.schema, restore.modeSwitchSnapshot)
    : null
  if (restore.modeSwitchSnapshot) {
    const precise = applyPmSelectionFromFrozenProjection({
      view: editor.view,
      schema: editor.schema,
      snapshot: {
        documentIdentity: restore.modeSwitchSnapshot.documentIdentity,
        expectedPmAnchor: restore.modeSwitchSnapshot.expectedPmAnchor,
        expectedPmHead: restore.modeSwitchSnapshot.expectedPmHead,
      },
    })
    restored = precise.ok
    if (inspectCtx) {
      recordPostApplyInspection(inspectCtx, editor.view, precise)
    }
  }
  if (!restored) {
    const a = Math.max(1, Math.min(Math.round(restore.pmAnchor), max))
    const h = Math.max(1, Math.min(Math.round(restore.pmHead), max))
    try {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, a, h)))
      if (inspectCtx) {
        recordPostApplyInspection(inspectCtx, editor.view, { ok: true })
      }
    } catch {
      return
    }
  }
  const head = editor.state.selection.head
  const dom = editor.view.dom as HTMLElement
  debugModeSwitch('[mode-switch][visual-pane][apply-selection]', {
    documentKey: restore.documentKey,
    captureFrameId: restore.modeSwitchSnapshot?.captureFrameId ?? null,
    selectionAfterApply: {
      anchor: editor.state.selection.anchor,
      head: editor.state.selection.head,
    },
    scrollBeforeViewport: describeScrollMetrics(dom),
    snapshot: summarizeSnapshot(restore.modeSwitchSnapshot),
  })
  const cancelled = () => editor.isDestroyed || !editor.view?.dom
  void (async () => {
    let viewportResult: VisualViewportRestoreResult = 'scroll_skipped'
    let centerReason: string | null = null
    try {
      const layoutStable = await waitLayoutStabilizationBarrier(
        MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
        cancelled,
      )
      if (!layoutStable || cancelled()) return
      const scrollContainer = revealScrollContainer(editor)
      if (inspectCtx) {
        recordPreViewportInspection(inspectCtx, editor.view)
      }
      const focusStable = await waitLayoutStabilizationBarrier(PRE_FOCUS_STABLE_FRAMES, cancelled)
      if (!focusStable || cancelled()) return
      editor.commands.focus(undefined, { scrollIntoView: false })
      let centered = applyProseMirrorCaretAnchorScroll({
        coordsAtPos: (pos) => editor.view.coordsAtPos(pos),
        scrollerEl: scrollContainer,
        calibrationEl: dom,
        headPos: head,
        anchorFraction: 0.5,
        includeWindowScroll: false,
      })
      if (centered.ok) {
        viewportResult = 'scroll_centered'
        centerReason = 'caret'
      } else if (restore.scrollRatio != null) {
        restoreProseMirrorScrollRatio(editor, restore.scrollRatio)
        viewportResult = 'scroll_nearby'
        centerReason = 'scroll_ratio'
        const retryStable = await waitLayoutStabilizationBarrier(1, cancelled)
        if (retryStable && !cancelled()) {
          centered = applyProseMirrorCaretAnchorScroll({
            coordsAtPos: (pos) => editor.view.coordsAtPos(pos),
            scrollerEl: scrollContainer,
            calibrationEl: dom,
            headPos: head,
            anchorFraction: 0.5,
            includeWindowScroll: false,
          })
          if (centered.ok) {
            viewportResult = 'scroll_centered'
            centerReason = 'caret_after_ratio'
          }
        }
      } else {
        centerReason = centered.reason
      }
    } catch {
      // Viewport restore is best-effort; inspection/logging still runs below.
    } finally {
      if (!cancelled()) {
        if (inspectCtx) {
          recordPostViewportInspection(inspectCtx, editor.view)
          logModeSwitchProjectionInspectLines(
            inspectCtx,
            `frame:${restore.modeSwitchSnapshot?.captureFrameId ?? 'none'}:${restore.documentKey}`,
          )
        }
        debugModeSwitch('[mode-switch][visual-pane][after-viewport]', {
          documentKey: restore.documentKey,
          captureFrameId: restore.modeSwitchSnapshot?.captureFrameId ?? null,
          appliedScrollRatio: restore.scrollRatio ?? null,
          viewportResult,
          centerReason,
          scrollAfterViewport: describeScrollMetrics(dom),
          selectionAfterViewport: {
            anchor: editor.state.selection.anchor,
            head: editor.state.selection.head,
          },
        })
      }
    }
  })()
}

export function revealScrollContainer(editor: Editor): HTMLElement {
  const root = editor.view.dom as HTMLElement
  let current: HTMLElement | null = root
  while (current) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    const canScrollY =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight + 1
    if (canScrollY) return current
    current = current.parentElement
  }
  return root
}
