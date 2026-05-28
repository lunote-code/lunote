import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { memo, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { sanitizeEmbeddedHtml } from './lunaHtmlSanitize'
import { parseHtmlCommentBody } from './lunaHtmlComment'
import { startMarkdownBlockSourceReveal } from './lunaMarkdownSourceReveal'

/** Consistent with `rawBlock` node attrs.source and serialization fence `source:` lines*/
export type LunaRawSource = 'html' | 'unknown' | 'invalid'

export function normalizeLunaRawSource(v: unknown): LunaRawSource {
  const s = String(v ?? '').toLowerCase()
  if (s === 'html' || s === 'unknown' || s === 'invalid') return s
  return 'unknown'
}

function sanitizeHtmlFragment(html: string): string {
  return sanitizeEmbeddedHtml(html)
}

const LunaRawBlockView = memo(function LunaRawBlockView(props: ReactNodeViewProps) {
  const { node, editor, getPos } = props
  const source = normalizeLunaRawSource(node.attrs.source)
  const raw = String(node.attrs.content ?? '')
  const surfaceRef = useRef<HTMLDivElement>(null)

  const onCommentBlockDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos !== 'number') return
      startMarkdownBlockSourceReveal(editor.view, { pos })
    },
    [editor.view, getPos],
  )

  useEffect(() => {
    if (source !== 'html') return
    const el = surfaceRef.current
    if (!el) return
    el.innerHTML = sanitizeHtmlFragment(raw)
  }, [source, raw])

  if (source === 'html') {
    const commentBody = parseHtmlCommentBody(raw)
    if (commentBody != null) {
      return (
        <NodeViewWrapper
          as="div"
          className="pm-luna-raw-block pm-luna-html-comment-block"
          data-luna-raw-block="1"
          data-source="html"
          data-type="html-comment-block"
          title={commentBody ? `${commentBody} (double-click to edit)` : 'Comment (double-click to edit)'}
          onDoubleClick={onCommentBlockDoubleClick}
        >
          <div
            className="pm-luna-html-comment-block-surface"
            contentEditable={false}
            suppressContentEditableWarning
            data-raw-comment={raw}
          >
            <span className="pm-luna-html-comment-badge">
              {'<!-- '}
              {commentBody || 'comment'}
              {' -->'}
            </span>
          </div>
        </NodeViewWrapper>
      )
    }
    return (
      <NodeViewWrapper
        as="div"
        className="pm-luna-raw-block pm-luna-html-block"
        data-luna-raw-block="1"
        data-source="html"
        data-type="html-block"
      >
        <div ref={surfaceRef} className="pm-luna-html-block-surface" contentEditable={false} suppressContentEditableWarning />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="div"
      className="pm-luna-raw-block pm-luna-raw-block--text"
      data-luna-raw-block="1"
      data-source={source}
    >
      <pre className="pm-luna-raw-block-pre">{raw}</pre>
    </NodeViewWrapper>
  )
})

/**
 * Host markdown-it `html_block` / fence original text, etc.
 * `source: html` is rendered as HTML after DOMPurify in WYSIWYG (not code block); other sources are still `pre` plain text.
 */
export const LunaRawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (el) => {
          const root = el as HTMLElement
          const surf = root.querySelector('.pm-luna-html-block-surface')
          if (surf) {
            const clone = surf.cloneNode(true) as HTMLElement
            clone.querySelectorAll('pre.pm-luna-raw-block-pre--html-source').forEach((p) => p.remove())
            return clone.innerHTML
          }
          return root.querySelector('pre')?.textContent ?? ''
        },
      },
      source: {
        default: 'unknown' as LunaRawSource,
        parseHTML: (el) => normalizeLunaRawSource((el as HTMLElement).getAttribute('data-source')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-luna-raw-block]' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LunaRawBlockView)
  },

  renderHTML({ node, HTMLAttributes }) {
    const source = normalizeLunaRawSource(node.attrs.source)
    const content = String(node.attrs.content ?? '')
    if (source === 'html') {
      const safeContent = sanitizeHtmlFragment(content)
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-luna-raw-block': '1',
          'data-source': 'html',
          'data-type': 'html-block',
          class: 'pm-luna-raw-block pm-luna-html-block',
        }),
        [
          'div',
          { class: 'pm-luna-html-block-surface' },
          ['pre', { class: 'pm-luna-raw-block-pre pm-luna-raw-block-pre--html-source' }, safeContent],
        ],
      ]
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-luna-raw-block': '1',
        'data-source': source,
        class: 'pm-luna-raw-block pm-luna-raw-block--text',
      }),
      ['pre', { class: 'pm-luna-raw-block-pre' }, content],
    ]
  },
})
