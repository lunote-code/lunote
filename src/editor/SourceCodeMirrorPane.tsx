import { useLayoutEffect, useRef, type CSSProperties, type DragEvent } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { scrollCodeMirrorViewToPos } from './caretAnchorScroll'
import { createModeSwitchEditorState } from './createModeSwitchEditorState'
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
  onFilesDrop?: (files: File[]) => Promise<string[]>
  className?: string
  style?: CSSProperties
}

/**
 * Source editor: **Single** `EditorState.create` every time `mountKey` changes.
 * ColdOpen: only doc+extensions, no dispatch/focus/scroll.
 * There is `restoreSelection`: the selection is written in create; the viewport is written in `scrollIntoView` in `requestMeasure`.
 */
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
       
      console.warn('[CM_DOM_INSTANCE]', { mountKey, node: wrapper })
    }

    const syncExt: Extension = EditorView.updateListener.of((vu) => {
      if (vu.docChanged) onChangeRef.current(vu.state.doc.toString())
    })

    const len = doc.length
    const effectiveRestore = restoreSelection ?? null

    if (openReason === EditorOpenReason.ColdOpen && effectiveRestore != null && import.meta.env.DEV) {
       
      console.warn('[CM_COLD_OPEN_WITH_RESTORE]', { mountKey, restoreSelection: effectiveRestore })
    }

    if (import.meta.env.DEV) {
       
      console.warn('[CM_BOOT]', {
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

      const waitForViewportReady = (attempt: number, run: () => void): void => {
        const h = view.scrollDOM.clientHeight
        if (h > 0 || attempt >= MAX_VIEWPORT_RESTORE_RAF_RETRIES) {
          run()
          return
        }
        requestAnimationFrame(() => waitForViewportReady(attempt + 1, run))
      }

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

      if (tabScrollTop != null || tabScrollRatio != null) {
        waitForViewportReady(0, () => {
          const max = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
          const nextTop =
            tabScrollTop != null ? Math.max(0, Math.min(tabScrollTop, max)) : Math.max(0, Math.min(max * (tabScrollRatio ?? 0), max))
          view.scrollDOM.scrollTop = nextTop
          view.focus()
          logViewportRestore('scroll_nearby', { appliedScrollTop: nextTop })
        })
      } else {
        const head = EditorSelection.single(
          Math.max(0, Math.min(effectiveRestore.from, len)),
          Math.max(0, Math.min(effectiveRestore.to, len)),
        ).main.head
        waitForViewportReady(0, () => {
          requestAnimationFrame(() => {
            if ((view as unknown as { destroyed?: boolean }).destroyed) return
            try {
              scrollCodeMirrorViewToPos(view, head, { select: false, focus: true })
              logViewportRestore('scroll_centered', { head })
            } catch {
              logViewportRestore('scroll_skipped', { head })
            }
          })
        })
      }
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
    const view = viewRef.current
    if (!files.length || !handler || !view) return
    event.preventDefault()
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from
    void (async () => {
      const snippets = await handler(files)
      if (!snippets.length) return
      view.dispatch({
        changes: {
          from: pos,
          to: pos,
          insert: snippets.join('\n'),
        },
        selection: EditorSelection.cursor(pos + snippets.join('\n').length),
      })
      view.focus()
    })()
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
