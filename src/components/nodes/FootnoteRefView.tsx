import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'

function displayIndex(index: number): string {
  if (index <= 0) return '?'
  const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  if (index < 10) return digits[index]!
  return String(index)
}

export const FootnoteRefView = memo(function FootnoteRefView(props: ReactNodeViewProps) {
  const { node, editor } = props
  const { t } = useI18n()
  const label = String(node.attrs.label ?? '')
  const index = Number(node.attrs.index ?? 0)
  const preview = String(node.attrs.preview ?? '')
  const singleClickTimerRef = useRef<number | null>(null)
  const jumpHint = preview
    ? `${preview}${t('editor.footnote.jumpHint')}`
    : t('editor.footnote.jumpHintEmpty')

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current != null) {
        window.clearTimeout(singleClickTimerRef.current)
        singleClickTimerRef.current = null
      }
    }
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const allowNavigate = e.ctrlKey || e.metaKey
      if (!allowNavigate) return
      e.preventDefault()
      e.stopPropagation()
      if (singleClickTimerRef.current != null) {
        window.clearTimeout(singleClickTimerRef.current)
        singleClickTimerRef.current = null
      }
      //Delay processing of click jumps to avoid breaking double click gesture links.
      if (e.detail !== 1) return
      singleClickTimerRef.current = window.setTimeout(() => {
        singleClickTimerRef.current = null
        const root = editor.view.dom
        const target = root.querySelector(`[data-footnote-def="${CSS.escape(label)}"]`)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          target.classList.add('pm-footnote-def-flash')
          window.setTimeout(() => target.classList.remove('pm-footnote-def-flash'), 1200)
        }
      }, 220)
    },
    [editor.view.dom, label],
  )

  return (
    <NodeViewWrapper as="span" className="pm-footnote-ref-wrap">
      <sup
        className="pm-footnote-ref"
        data-footnote-label={label}
        data-footnote-index={index}
        title={jumpHint}
        onClick={onClick}
      >
        [{displayIndex(index)}]
      </sup>
    </NodeViewWrapper>
  )
})
