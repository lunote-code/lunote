import { useLayoutEffect, useRef, type CSSProperties, type DragEvent } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { applyCodeMirrorCaretAnchorScroll, scrollCodeMirrorToLineBlock } from './caretAnchorScroll'
import { createModeSwitchEditorState } from './createModeSwitchEditorState'
import {
  MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
  POST_SCROLL_CARET_REFINE_FRAMES,
  PRE_FOCUS_STABLE_FRAMES,
  waitLayoutStabilizationBarrier,
} from './layoutStabilization'
import { debugModeSwitch, describeScrollMetrics, describeSelectionInText } from './modeSwitchDebug'
import { EditorOpenReason, type EditorOpenReason as EditorSurfaceOpenReason } from './editorOpenReason'

export type SourceCodeMirrorPaneProps = {
  /** Destroy and rebuild EditorView when changing; coldOpenGeneration and modeSwitchGeneration must be included to avoid scroll DOM reuse*/
  mountKey: string
  /** The full text of the document mounted for the first time under this mountKey; it is then held by EditorView. Typing synchronization of the parent component does not trigger the reconstruction of this component.*/
  doc: string
  /** Cold open must be `ColdOpen`; `restoreSelection` will be carried when mode switch is restored*/
  openReason: EditorSurfaceOpenReason
  /**
   * Mode switching restores the selection; should be `undefined` on cold open.
   */
  restoreSelection?: { from: number; to: number; scrollTop?: number; scrollRatio?: number }
  extensions: Extension[]
  onChange: (value: string) => void
  onViewReady?: (view: EditorView) => void
  onFilesDrop?: (files: File[]) => Promise<void>
  className?: string
  style?: CSSProperties
}

/**
 * Source editor: **Single** `EditorState.create` every time `mountKey` changes.
 * ColdOpen: only doc+extensions, no dispatch/focus/scroll.
 * There is `restoreSelection`: the selection is written in create; the viewport follows the same caret-anchor path as visual mode restore.
 */
function applySourceScrollRatio(
  scrollDOM: HTMLElement,
  tabScrollTop: number | null,
  tabScrollRatio: number | null,
): void {
  const max = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  if (max <= 0) return
  if (tabScrollTop != null) {
    scrollDOM.scrollTop = Math.max(0, Math.min(tabScrollTop, max))
    return
  }
  if (tabScrollRatio != null) {
    scrollDOM.scrollTop = Math.max(0, Math.min(max * tabScrollRatio, max))
  }
}

export function SourceCodeMirrorPane({
  mountKey,
  doc,
  openReason,
  restoreSelection,
  extensions,
  onChange,
  onViewReady,
  onFilesDrop,
  className,
  style,
}: SourceCodeMirrorPaneProps) {
  const MAX_VIEWPORT_RESTORE_RAF_RETRIES = 8
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onViewReadyRef = useRef(onViewReady)
  onViewReadyRef.current = onViewReady
  const onFilesDropRef = useRef(onFilesDrop)
  onFilesDropRef.current = onFilesDrop

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const root = rootRef.current
    if (!wrapper || !root) return

    if (import.meta.env.DEV) {
      debugModeSwitch('[mode-switch][source-pane][dom-instance]', {
        mountKey,
        hasNode: Boolean(wrapper),
      })
    }

    const syncExt: Extension = EditorView.updateListener.of((vu) => {
      if (vu.docChanged) onChangeRef.current(vu.state.doc.toString())
    })

    const len = doc.length
    const effectiveRestore = restoreSelection ?? null

    if (openReason === EditorOpenReason.ColdOpen && effectiveRestore != null && import.meta.env.DEV) {
      debugModeSwitch('[mode-switch][source-pane][cold-open-with-restore]', {
        mountKey,
        restoreSelection: effectiveRestore,
      })
    }

    if (import.meta.env.DEV) {
      debugModeSwitch('[mode-switch][source-pane][boot]', {
        mountKey,
        hasRestoreSelection: effectiveRestore != null,
        restoreSelection: effectiveRestore,
        docLength: doc.length,
        openReason,
      })
    }

    const state =
      effectiveRestore != null
        ? createModeSwitchEditorState({
            doc,
            extensions: [...extensions, syncExt],
            selection: EditorSelection.single(
              Math.max(0, Math.min(effectiveRestore.from, len)),
              Math.max(0, Math.min(effectiveRestore.to, len)),
            ),
          })
        : createModeSwitchEditorState({
            doc,
            extensions: [...extensions, syncExt],
          })

    root.replaceChildren()
    const view = new EditorView({ state, parent: root })
    viewRef.current = view
    onViewReadyRef.current?.(view)

    if (import.meta.env.DEV) {
      debugModeSwitch('[mode-switch][source-pane][created]', {
        mountKey,
        openReason,
        selection: describeSelectionInText(
          doc,
          view.state.selection.main.anchor,
          view.state.selection.main.head,
        ),
        restoreSelection: effectiveRestore
          ? describeSelectionInText(doc, effectiveRestore.from, effectiveRestore.to)
          : null,
        scroll: describeScrollMetrics(view.scrollDOM),
      })
    }

    if (effectiveRestore != null) {
      const tabScrollTop =
        effectiveRestore.scrollTop != null && Number.isFinite(effectiveRestore.scrollTop)
          ? effectiveRestore.scrollTop
          : null
      const tabScrollRatio =
        effectiveRestore.scrollRatio != null && Number.isFinite(effectiveRestore.scrollRatio)
          ? Math.max(0, Math.min(1, effectiveRestore.scrollRatio))
          : null
      const head = EditorSelection.single(
        Math.max(0, Math.min(effectiveRestore.from, len)),
        Math.max(0, Math.min(effectiveRestore.to, len)),
      ).main.head
      const cancelled = () => Boolean((view as unknown as { destroyed?: boolean }).destroyed)

      const logViewportRestore = (result: 'scroll_nearby' | 'scroll_centered' | 'scroll_skipped', extra?: object) => {
        debugModeSwitch('[mode-switch][source-pane][viewport-restore]', {
          mountKey,
          result,
          requestedScrollTop: tabScrollTop,
          requestedScrollRatio: tabScrollRatio,
          selection: describeSelectionInText(
            doc,
            view.state.selection.main.anchor,
            view.state.selection.main.head,
          ),
          scroll: describeScrollMetrics(view.scrollDOM),
          ...extra,
        })
      }

      const restoreViewport = async () => {
        for (let attempt = 0; attempt <= MAX_VIEWPORT_RESTORE_RAF_RETRIES; attempt++) {
          if (cancelled()) return
          if (view.scrollDOM.clientHeight > 0) break
          const ready = await waitLayoutStabilizationBarrier(1, cancelled)
          if (!ready) return
        }
        if (cancelled()) return

        const layoutStable = await waitLayoutStabilizationBarrier(
          MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
          cancelled,
        )
        if (!layoutStable || cancelled()) return

        const focusStable = await waitLayoutStabilizationBarrier(PRE_FOCUS_STABLE_FRAMES, cancelled)
        if (!focusStable || cancelled()) return

        const calibrationEl = view.contentDOM as HTMLElement
        let result: 'scroll_nearby' | 'scroll_centered' | 'scroll_skipped' = 'scroll_skipped'
        let centerReason = 'skipped'

        let centered = applyCodeMirrorCaretAnchorScroll({
          view,
          scrollDOM: view.scrollDOM,
          docPos: head,
          calibrationEl,
          includeWindowScroll: false,
        })

        if (centered.ok) {
          result = 'scroll_centered'
          centerReason = 'caret'
        } else if (tabScrollTop != null || tabScrollRatio != null) {
          applySourceScrollRatio(view.scrollDOM, tabScrollTop, tabScrollRatio)
          result = 'scroll_nearby'
          centerReason = 'scroll_ratio'
          const retryStable = await waitLayoutStabilizationBarrier(1, cancelled)
          if (retryStable && !cancelled()) {
            centered = applyCodeMirrorCaretAnchorScroll({
              view,
              scrollDOM: view.scrollDOM,
              docPos: head,
              calibrationEl,
              includeWindowScroll: false,
            })
            if (centered.ok) {
              result = 'scroll_centered'
              centerReason = 'caret_after_ratio'
            }
          }
        } else if (scrollCodeMirrorToLineBlock(view, head)) {
          result = 'scroll_centered'
          centerReason = 'line_block'
        }

        const refineStable = await waitLayoutStabilizationBarrier(POST_SCROLL_CARET_REFINE_FRAMES, cancelled)
        if (refineStable && !cancelled()) {
          applyCodeMirrorCaretAnchorScroll({
            view,
            scrollDOM: view.scrollDOM,
            docPos: head,
            calibrationEl,
            includeWindowScroll: false,
          })
        }

        try {
          view.focus()
        } catch {
          /* ignore */
        }

        logViewportRestore(result, { head, centerReason })
      }

      void restoreViewport()
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps -- only rebuild the instance when the mountKey changes; doc/openReason/restore is bound to the mount
  }, [mountKey])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault()
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files ?? [])
    const handler = onFilesDropRef.current
    if (!files.length || !handler) return
    event.preventDefault()
    event.stopPropagation()
    void handler(files)
  }

  return (
    <div
      ref={wrapperRef}
      data-mode-switch-instance={mountKey}
      className={className}
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={rootRef} style={{ height: '100%', minHeight: 0 }} />
    </div>
  )
}
