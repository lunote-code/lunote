import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type FocusEvent, type KeyboardEvent, type ClipboardEvent } from 'react'
import { highlightHtmlSource } from './lunaHtmlSourceHighlight'
import { pastePlainIntoBlockSourceTextarea } from './blockSourceTextareaPaste'
import { useI18n } from '../i18n'

type Props = {
  value: string
  onChange: (next: string) => void
  onCommit: () => void
  onCancel: () => void
}

export const LunaHtmlBlockSourceEditor = memo(function LunaHtmlBlockSourceEditor({
  value,
  onChange,
  onCommit,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)

  const highlighted = useMemo(() => highlightHtmlSource(value), [value])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = highlightRef.current
    if (!ta || !pre) return
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }, [])

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = `${Math.max(44, ta.scrollHeight)}px`
  }, [])

  useLayoutEffect(() => {
    adjustHeight()
    syncScroll()
  }, [value, adjustHeight, syncScroll])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus({ preventScroll: true })
      const end = ta.value.length
      ta.setSelectionRange(end, end)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onCommit()
      }
    },
    [onCancel, onCommit],
  )

  const onBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      const related = event.relatedTarget
      if (related instanceof Node && event.currentTarget.closest('.pm-luna-html-source-editor')?.contains(related)) {
        return
      }
      onCommit()
    },
    [onCommit],
  )

  return (
    <div className="pm-luna-html-source-editor" contentEditable={false}>
      <span className="pm-luna-html-source-badge" aria-hidden>
        {t('editor.htmlBlock.badge')} <span className="pm-luna-html-source-badge-mark">✓</span>
      </span>
      <div className="pm-luna-html-source-panel">
        <div className="pm-luna-html-source-field">
          <pre ref={highlightRef} className="pm-luna-html-source-highlight" aria-hidden>
            <code className="language-xml hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          <textarea
            ref={textareaRef}
            className="pm-luna-html-source-input"
            value={value}
            spellCheck={false}
            rows={1}
            aria-label={t('editor.htmlBlock.sourceAria')}
            onChange={(event) => {
              onChange(event.currentTarget.value)
              requestAnimationFrame(() => {
                adjustHeight()
                syncScroll()
              })
            }}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
              void pastePlainIntoBlockSourceTextarea(event, onChange)
            }}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
      </div>
    </div>
  )
})
