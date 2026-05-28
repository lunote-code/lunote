import katex from 'katex'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

const cacheBlock = new Map<string, string>()

export const MathBlockView = memo(function MathBlockView(props: ReactNodeViewProps) {
  const latexRaw = String(props.node.attrs.latex ?? '')
  const [quickEditActive, setQuickEditActive] = useState(false)
  const [quickEditValue, setQuickEditValue] = useState(latexRaw)
  const clickTimerRef = useRef<number | null>(null)
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
      props.updateAttributes({ latex: next })
    }
    setQuickEditActive(false)
  }, [latexRaw, props, quickEditValue])

  const handlePreviewClick = useCallback(() => {
    if (!editable || quickEditActive) return
    clearPendingClick()
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      openQuickEdit()
    }, 280)
  }, [clearPendingClick, editable, openQuickEdit, quickEditActive])

  const handlePreviewDoubleClick = useCallback(() => {
    clearPendingClick()
    if (quickEditActive) closeQuickEdit()
  }, [clearPendingClick, closeQuickEdit, quickEditActive])

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
      title={editable ? 'Click to quick edit LaTeX' : undefined}
    >
      {quickEditActive ? (
        <div className="pm-math-quick-editor" contentEditable={false}>
          <div className="pm-math-quick-title">LaTeX</div>
          <textarea
            ref={textareaRef}
            className="pm-math-quick-textarea"
            value={quickEditValue}
            onChange={(event) => setQuickEditValue(event.currentTarget.value)}
            onKeyDown={handleQuickEditKeyDown}
            onBlur={commitQuickEdit}
            placeholder="Enter LaTeX formula..."
            spellCheck={false}
          />
        </div>
      ) : null}
      <div className="pm-math-preview-hit" onClick={handlePreviewClick} onDoubleClick={handlePreviewDoubleClick}>
        {previewNode}
      </div>
    </NodeViewWrapper>
  )
})
