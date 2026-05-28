import type { Editor } from '@tiptap/core'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

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
import { useMermaidSourceSession } from '../../editor/mermaid/MermaidSourceSession'
import { installMermaidSourceTextareaHandlers } from '../../editor/mermaid/mermaidSourceTextareaHandlers'

type Props = {
  blockId: string
  editor: Editor
  isActive: boolean
}

/** CBR document stream textarea (Selection Cycle v2 frame barrier)*/
export const MermaidBlockSourceEditor = memo(function MermaidBlockSourceEditor({
  blockId,
  editor,
  isActive,
}: Props) {
  const { setDraft, setComposing, setActiveBlockId } = useMermaidSourceSession()
  const draft = useCodeBlockDraft(blockId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Frame N: Synchronize with DOM to avoid controlled value rolling back before N+1 commit*/
  const [pipelineDraft, setPipelineDraft] = useState<string | null>(null)

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

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) resetSelectionFrameForBlock(ta, blockId)
  }, [blockId])

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

  useEffect(() => {
    if (!isActive) return
    textareaRef.current?.focus()
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
      acquireBlockTextareaFocus(blockId, e.currentTarget, editor)
      editor.commands.blur()
      setActiveBlockId(blockId)
    },
    [editor, blockId, setActiveBlockId],
  )

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      releaseBlockTextareaFocus(e.currentTarget, editor)
      resumeRemotePatch(blockId)
      reconcileRemoteQueue(blockId)
    },
    [editor, blockId],
  )

  const displayValue = pipelineDraft ?? draft

  return (
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
  )
})
