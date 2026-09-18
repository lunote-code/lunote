import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useI18n } from '../i18n'
import { renderEmbeddedHtml, sanitizeEmbeddedHtml } from './lunaHtmlSanitize'
import { parseHtmlCommentBody } from './lunaHtmlComment'
import { startInlineMarkdownReveal } from './lunaMarkdownSourceReveal'
import { normalizeLunaRawSource, type LunaRawSource } from './lunaRawBlock'
import {
  handleEmbeddedHtmlMediaMouseDown,
  shouldAttachEmbeddedHtmlMediaMouseDownGuard,
  shouldStopEmbeddedHtmlSurfaceNodeViewEvent,
} from './embeddedHtmlMediaInteraction'

const LunaRawInlineView = memo(function LunaRawInlineView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { node, editor, extension } = props
  const source = normalizeLunaRawSource(node.attrs.source)
  const raw = String(node.attrs.content ?? '')
  const extensionOptions = extension.options as {
    resolveMediaSrc?: (src: string) => string
    getMediaRenderScope?: () => string
  }
  const resolveMediaSrc = extensionOptions.resolveMediaSrc
  const mediaRenderScope = extensionOptions.getMediaRenderScope?.() ?? ''
  const surfaceRef = useRef<HTMLSpanElement>(null)

  const renderedHtml = useMemo(() => {
    if (source !== 'html') return ''
    return renderEmbeddedHtml(raw, { resolveMediaSrc, mediaRenderScope })
  }, [source, raw, resolveMediaSrc, mediaRenderScope])

  const onEmbeddedMediaMouseDown = handleEmbeddedHtmlMediaMouseDown

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

  useLayoutEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    if (source === 'html') {
      if (el.innerHTML !== renderedHtml) el.innerHTML = renderedHtml
      return
    }
    if (el.textContent !== raw) el.textContent = raw
  }, [source, raw, renderedHtml])

  if (source === 'html') {
    const commentBody = parseHtmlCommentBody(raw)
    if (commentBody != null) {
      const commentPlaceholder = t('editor.htmlComment.placeholder')
      const commentTitle = commentBody
        ? t('editor.htmlComment.editTitleWithBody', { body: commentBody })
        : t('editor.htmlComment.editTitleEmpty')
      return (
        <NodeViewWrapper
          as="span"
          className="pm-luna-raw-inline pm-luna-html-comment"
          data-luna-raw-inline="1"
          data-source="html"
          data-type="html-comment"
          title={commentTitle}
          onDoubleClick={onCommentDoubleClick}
        >
          <span className="pm-luna-html-comment-badge" contentEditable={false} suppressContentEditableWarning>
            {'<!-- '}
            {commentBody || commentPlaceholder}
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
        <span
          ref={surfaceRef}
          className="pm-luna-html-inline-surface"
          contentEditable={false}
          suppressContentEditableWarning
          onMouseDown={
            shouldAttachEmbeddedHtmlMediaMouseDownGuard(raw) ? onEmbeddedMediaMouseDown : undefined
          }
        />
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

  addOptions() {
    return {
      resolveMediaSrc: undefined as ((src: string) => string) | undefined,
      getMediaRenderScope: undefined as (() => string) | undefined,
    }
  },

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
    return ReactNodeViewRenderer(LunaRawInlineView, {
      stopEvent: ({ event }) => shouldStopEmbeddedHtmlSurfaceNodeViewEvent(event),
      ignoreMutation: ({ mutation }) => {
        const target = mutation.target
        if (!(target instanceof Node)) return false
        const el = target instanceof Element ? target : target.parentElement
        return !!el?.closest('.pm-luna-html-inline-surface')
      },
    })
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
