import type { Editor } from '@tiptap/core'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  acquireBlockTextareaFocus,
  releaseBlockTextareaFocus,
  setNativeTextareaComposing,
} from '../../editor/documentRuntime'
import { CODE_BLOCK_INPUT_CLASS } from '../../editor/codeBlockRuntime'
import { reconcileRemoteQueue, resumeRemotePatch } from '../../editor/codeBlockRuntime/collab'
import { useCodeBlockDraft } from '../../editor/codeBlockRuntime/useCodeBlock'
import { setTextareaComposing } from '../../editor/nativeInput/selectionCycle'
import { resetSelectionFrameForBlock } from '../../editor/nativeInput/selectionCycle/v2'
import { debugMermaid } from '../../editor/mermaid/mermaidDebug'
import { useMermaidSourceSession } from '../../editor/mermaid/MermaidSourceSession'
import { installMermaidSourceTextareaHandlers } from '../../editor/mermaid/mermaidSourceTextareaHandlers'

type Props = {
  blockId: string
  editor: Editor
  isActive: boolean
  preferredHeight?: number
}

/** CBR document stream textarea (Selection Cycle v2 frame barrier)*/
export const MermaidBlockSourceEditor = memo(function MermaidBlockSourceEditor({
  blockId,
  editor,
  isActive,
  preferredHeight,
}: Props) {
  const minEditorHeight = 180
  const { setDraft, setComposing, setActiveBlockId } = useMermaidSourceSession()
  const draft = useCodeBlockDraft(blockId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const manualHeightRef = useRef<number | null>(null)
  /** Frame N: Synchronize with DOM to avoid controlled value rolling back before N+1 commit*/
  const [pipelineDraft, setPipelineDraft] = useState<string | null>(null)
  const [manualHeightVersion, setManualHeightVersion] = useState(0)

  const onDomAuthority = useCallback((value: string) => {
    setPipelineDraft(value)
  }, [])

  const syncNativeEdit = useCallback(
    (value: string) => {
      setDraft(blockId, value)
      setPipelineDraft(null)
    },
    [blockId, setDraft],
  )

  const onPipelineComplete = useCallback(() => {
    setPipelineDraft(null)
  }, [])

  const displayValue = pipelineDraft ?? draft

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) resetSelectionFrameForBlock(ta, blockId)
  }, [blockId])

  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const targetHeight = manualHeightRef.current ?? preferredHeight ?? 0
    ta.style.height = `${Math.max(minEditorHeight, targetHeight)}px`
  }, [blockId, preferredHeight, manualHeightVersion])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    return installMermaidSourceTextareaHandlers(ta, {
      blockId,
      onDomAuthority,
      onValueChange: syncNativeEdit,
      onPipelineComplete,
    })
  }, [blockId, onDomAuthority, syncNativeEdit, onPipelineComplete])

  useLayoutEffect(() => {
    if (!isActive) return
    debugMermaid('source_editor_activate', {
      blockId,
    })
    const raf = requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [isActive, blockId])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPipelineDraft(null)
      setDraft(blockId, e.target.value)
    },
    [blockId, setDraft],
  )

  const onCompositionStart = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      setTextareaComposing(e.currentTarget, true)
      setNativeTextareaComposing(e.currentTarget, true)
      setComposing(true)
    },
    [setComposing],
  )
  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      setTextareaComposing(e.currentTarget, false)
      setNativeTextareaComposing(e.currentTarget, false)
      setComposing(false)
    },
    [setComposing],
  )

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      debugMermaid('source_editor_focus', {
        blockId,
        valueLength: e.currentTarget.value.length,
      })
      acquireBlockTextareaFocus(blockId, e.currentTarget, editor)
      setActiveBlockId(blockId)
    },
    [editor, blockId, setActiveBlockId],
  )

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      debugMermaid('source_editor_blur', {
        blockId,
        valueLength: e.currentTarget.value.length,
      })
      releaseBlockTextareaFocus(e.currentTarget, editor)
      resumeRemotePatch(blockId)
      reconcileRemoteQueue(blockId)
    },
    [editor, blockId],
  )

  const onResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const ta = textareaRef.current
      if (!ta) return
      const startY = e.clientY
      const startHeight = ta.getBoundingClientRect().height
      const prevUserSelect = document.body.style.userSelect
      const prevCursor = document.body.style.cursor
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ns-resize'

      const onMove = (event: MouseEvent) => {
        const nextHeight = Math.max(minEditorHeight, Math.round(startHeight + event.clientY - startY))
        manualHeightRef.current = nextHeight
        ta.style.height = `${nextHeight}px`
      }
      const onUp = () => {
        document.body.style.userSelect = prevUserSelect
        document.body.style.cursor = prevCursor
        setManualHeightVersion((value) => value + 1)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [minEditorHeight],
  )

  return (
    <div className="pm-mermaid-source-frame">
      <textarea
        ref={textareaRef}
        className={`code-block-input pm-mermaid-source-panel ${CODE_BLOCK_INPUT_CLASS}`}
        data-mermaid-block-id={blockId}
        data-code-block-input=""
        data-native-input=""
        tabIndex={0}
        value={displayValue}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        draggable={false}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        spellCheck={false}
        aria-label="Mermaid source code"
      />
      <div
        className="pm-mermaid-source-resize-handle"
        role="presentation"
        aria-hidden="true"
        onMouseDown={onResizeHandleMouseDown}
      />
    </div>
  )
})
