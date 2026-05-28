import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { sanitizeEmbeddedHtml } from './lunaHtmlSanitize'
import { parseHtmlCommentBody } from './lunaHtmlComment'
import { startInlineMarkdownReveal } from './lunaMarkdownSourceReveal'
import { normalizeLunaRawSource, type LunaRawSource } from './lunaRawBlock'

const LunaRawInlineView = memo(function LunaRawInlineView(props: ReactNodeViewProps) {
  const { node, editor } = props
  const source = normalizeLunaRawSource(node.attrs.source)
  const raw = String(node.attrs.content ?? '')
  const ref = useRef<HTMLSpanElement>(null)

  const onCommentDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const getPos = props.getPos
      if (typeof getPos !== 'function') return
      const from = getPos()
      if (from == null || from < 0) return
      const md = raw.trim()
      if (!md || parseHtmlCommentBody(md) == null) return
      event.preventDefault()
      event.stopPropagation()
      const to = from + props.node.nodeSize
      startInlineMarkdownReveal(editor.view, from, to, md)
    },
    [editor.view, props.getPos, props.node.nodeSize, raw],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (source === 'html') {
      el.innerHTML = sanitizeEmbeddedHtml(raw)
    } else {
      el.textContent = raw
    }
  }, [source, raw])

  if (source === 'html') {
    const commentBody = parseHtmlCommentBody(raw)
    if (commentBody != null) {
      return (
        <NodeViewWrapper
          as="span"
          className="pm-luna-raw-inline pm-luna-html-comment"
          data-luna-raw-inline="1"
          data-source="html"
          data-type="html-comment"
          title={commentBody ? `${commentBody} (double-click to edit)` : 'Comment (double-click to edit)'}
          onDoubleClick={onCommentDoubleClick}
        >
          <span className="pm-luna-html-comment-badge" contentEditable={false} suppressContentEditableWarning>
            {'<!-- '}
            {commentBody || 'comment'}
            {' -->'}
          </span>
        </NodeViewWrapper>
      )
    }
    return (
      <NodeViewWrapper
        as="span"
        className="pm-luna-raw-inline pm-luna-html-inline"
        data-luna-raw-inline="1"
        data-source="html"
        data-type="html-inline"
      >
        <span ref={ref} className="pm-luna-html-inline-surface" contentEditable={false} suppressContentEditableWarning />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="span"
      className="pm-luna-raw-inline pm-luna-raw-inline--text"
      data-luna-raw-inline="1"
      data-source={source}
    >
      {raw}
    </NodeViewWrapper>
  )
})

/** Inline HTML (markdown-it `html_inline`), etc.; `source: html` is rendered as HTML, non-monospaced code style*/
export const LunaRawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (el) => {
          const root = el as HTMLElement
          const surf = root.querySelector('.pm-luna-html-inline-surface')
          if (surf) {
            const clone = surf.cloneNode(true) as HTMLElement
            clone.querySelectorAll('.pm-luna-raw-inline-html-source').forEach((n) => n.remove())
            return clone.innerHTML
          }
          return root.textContent ?? ''
        },
      },
      source: {
        default: 'html' as LunaRawSource,
        parseHTML: (el) => normalizeLunaRawSource((el as HTMLElement).getAttribute('data-source')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-luna-raw-inline]' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LunaRawInlineView)
  },

  renderHTML({ node, HTMLAttributes }) {
    const source = normalizeLunaRawSource(node.attrs.source)
    const content = String(node.attrs.content ?? '')
    if (source === 'html') {
      const safe = sanitizeEmbeddedHtml(content)
      return [
        'span',
        mergeAttributes(HTMLAttributes, {
          'data-luna-raw-inline': '1',
          'data-source': 'html',
          'data-type': 'html-inline',
          class: 'pm-luna-raw-inline pm-luna-html-inline',
        }),
        ['span', { class: 'pm-luna-html-inline-surface' }, safe],
      ]
    }
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-luna-raw-inline': '1',
        'data-source': source,
        class: 'pm-luna-raw-inline pm-luna-raw-inline--text',
      }),
      content,
    ]
  },
})
