import katex from 'katex'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useI18n } from '../../i18n'
import { pastePlainIntoBlockSourceTextarea } from '../../editor/blockSourceTextareaPaste'
import { registerBlockSourceDraftSerializeFlush } from '../../editor/blockSourceDraftSerializeBridge'
import {
  MATH_PREVIEW_QUICK_EDIT_DELAY_MS,
  shouldCancelMathPreviewQuickEdit,
} from '../../editor/mathPreviewQuickEdit'

const cacheBlock = new Map<string, string>()

export const MathBlockView = memo(function MathBlockView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { node, updateAttributes, editor } = props
  const latexRaw = String(node.attrs.latex ?? '')
  const [quickEditActive, setQuickEditActive] = useState(false)
  const [quickEditValue, setQuickEditValue] = useState(latexRaw)
  const quickEditActiveRef = useRef(quickEditActive)
  const quickEditValueRef = useRef(quickEditValue)
  const latexRawRef = useRef(latexRaw)
  const clickTimerRef = useRef<number | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editable = props.editor.isEditable

  const clearPendingClick = useCallback(() => {
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearPendingClick()
  }, [clearPendingClick])

  useEffect(() => {
    if (quickEditActive) return
    setQuickEditValue(latexRaw)
  }, [latexRaw, quickEditActive])

  useEffect(() => {
    if (!quickEditActive) return
    const raf = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [quickEditActive])

  const openQuickEdit = useCallback(() => {
    if (!editable) return
    setQuickEditValue(latexRaw)
    setQuickEditActive(true)
  }, [editable, latexRaw])

  const closeQuickEdit = useCallback(() => {
    setQuickEditActive(false)
    setQuickEditValue(latexRaw)
  }, [latexRaw])

  const commitQuickEdit = useCallback(() => {
    const next = quickEditValue.replace(/\r\n/gu, '\n')
    if (next !== latexRaw) {
      updateAttributes({ latex: next })
    }
    setQuickEditActive(false)
  }, [latexRaw, quickEditValue, updateAttributes])

  quickEditActiveRef.current = quickEditActive
  quickEditValueRef.current = quickEditValue
  latexRawRef.current = latexRaw

  const flushMathQuickEditForSerialize = useCallback(() => {
    if (!quickEditActiveRef.current) return
    const next = quickEditValueRef.current.replace(/\r\n/gu, '\n')
    if (next !== latexRawRef.current) {
      updateAttributes({ latex: next })
    }
  }, [updateAttributes])

  useEffect(() => {
    return registerBlockSourceDraftSerializeFlush(editor, flushMathQuickEditForSerialize)
  }, [editor, flushMathQuickEditForSerialize])

  useEffect(() => {
    if (!quickEditActive) return
    const next = quickEditValue.replace(/\r\n/gu, '\n')
    if (next !== latexRaw) {
      updateAttributes({ latex: next })
    }
  }, [quickEditActive, quickEditValue, latexRaw, updateAttributes])

  const handlePreviewClick = useCallback(() => {
    if (!editable || quickEditActive) return
    clearPendingClick()
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      openQuickEdit()
    }, MATH_PREVIEW_QUICK_EDIT_DELAY_MS)
  }, [clearPendingClick, editable, openQuickEdit, quickEditActive])

  const handlePreviewDoubleClick = useCallback(() => {
    clearPendingClick()
    if (quickEditActive) closeQuickEdit()
  }, [clearPendingClick, closeQuickEdit, quickEditActive])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const host = hostRef.current
      const contains =
        host != null && event.target instanceof Node ? host.contains(event.target) : false
      if (shouldCancelMathPreviewQuickEdit(contains)) clearPendingClick()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [clearPendingClick])

  const handleQuickEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeQuickEdit()
        return
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        commitQuickEdit()
      }
    },
    [closeQuickEdit, commitQuickEdit],
  )

  const previewLatex = (quickEditActive ? quickEditValue : latexRaw).trim()
  const html = useMemo(() => {
    if (!previewLatex) return ''
    const key = `b:${previewLatex}`
    const hit = cacheBlock.get(key)
    if (hit) return hit
    try {
      const h = katex.renderToString(previewLatex, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
        trust: false,
      })
      cacheBlock.set(key, h)
      return h
    } catch {
      return ''
    }
  }, [previewLatex])

  const previewNode = html ? (
    <div className="pm-math-block-inner katex-display" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="pm-math-fallback">{previewLatex || ' '}</pre>
  )

  return (
    <NodeViewWrapper
      as="div"
      className={`pm-math-block${!previewLatex ? ' pm-math-block--empty' : ''}${quickEditActive ? ' pm-math-block--quick-active' : ''}`}
      data-type="block-math"
      data-latex={previewLatex}
      title={editable ? t('editor.math.quickEditTitle') : undefined}
    >
      <div ref={hostRef}>
        {quickEditActive ? (
          <div className="pm-math-quick-editor" contentEditable={false}>
            <div className="pm-math-quick-title">{t('editor.math.label')}</div>
            <textarea
              ref={textareaRef}
              className="pm-math-quick-textarea"
              value={quickEditValue}
              onChange={(event) => setQuickEditValue(event.currentTarget.value)}
              onKeyDown={handleQuickEditKeyDown}
              onBlur={commitQuickEdit}
              onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                void pastePlainIntoBlockSourceTextarea(event, setQuickEditValue)
              }}
              placeholder={t('editor.math.placeholder')}
              spellCheck={false}
            />
          </div>
        ) : null}
        <div className="pm-math-preview-hit" onClick={handlePreviewClick} onDoubleClick={handlePreviewDoubleClick}>
          {previewNode}
        </div>
      </div>
    </NodeViewWrapper>
  )
})
