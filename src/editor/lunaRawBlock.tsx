import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { LunaHtmlBlockSourceEditor } from './LunaHtmlBlockSourceEditor'
import { useI18n } from '../i18n'
import {
  renderEmbeddedHtml,
  sanitizeEmbeddedHtml,
  type RenderEmbeddedHtmlOptions,
} from './lunaHtmlSanitize'
import { parseHtmlCommentBody } from './lunaHtmlComment'
import { handleEmbeddedHtmlMediaMouseDown, shouldAttachEmbeddedHtmlMediaMouseDownGuard, shouldStopEmbeddedHtmlSurfaceNodeViewEvent } from './embeddedHtmlMediaInteraction'
import { registerBlockSourceDraftSerializeFlush } from './blockSourceDraftSerializeBridge'
import { startMarkdownBlockSourceReveal } from './lunaMarkdownSourceReveal'

/** Consistent with `rawBlock` node attrs.source and serialization fence `source:` lines*/
export type LunaRawSource = 'html' | 'unknown' | 'invalid'

export function normalizeLunaRawSource(v: unknown): LunaRawSource {
  const s = String(v ?? '').toLowerCase()
  if (s === 'html' || s === 'unknown' || s === 'invalid') return s
  return 'unknown'
}

function sanitizeHtmlFragment(html: string, options: RenderEmbeddedHtmlOptions): string {
  return renderEmbeddedHtml(html, options)
}

type LunaRawBlockExtensionOptions = {
  resolveMediaSrc?: (src: string) => string
  getMediaRenderScope?: () => string
}

const LunaRawBlockView = memo(function LunaRawBlockView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { node, editor, getPos, extension, updateAttributes } = props
  const source = normalizeLunaRawSource(node.attrs.source)
  const raw = String(node.attrs.content ?? '')
  const editable = editor.isEditable
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceDraft, setSourceDraft] = useState(raw)
  const sourceDraftRef = useRef(sourceDraft)
  const sourceOpenRef = useRef(sourceOpen)
  const rawRef = useRef(raw)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const extensionOptions = extension.options as LunaRawBlockExtensionOptions
  const resolveMediaSrc = extensionOptions.resolveMediaSrc
  const getMediaRenderScope = extensionOptions.getMediaRenderScope
  const mediaRenderScope = getMediaRenderScope?.() ?? ''

  sourceDraftRef.current = sourceDraft
  sourceOpenRef.current = sourceOpen
  rawRef.current = raw

  const flushHtmlSourceDraftForSerialize = useCallback(() => {
    if (!sourceOpenRef.current) return
    const next = sourceDraftRef.current.replace(/\r\n/gu, '\n')
    if (next !== rawRef.current) {
      updateAttributes({ content: next })
    }
  }, [updateAttributes])

  useEffect(() => {
    return registerBlockSourceDraftSerializeFlush(editor, flushHtmlSourceDraftForSerialize)
  }, [editor, flushHtmlSourceDraftForSerialize])

  const renderedHtml = useMemo(() => {
    if (source !== 'html' || sourceOpen) return ''
    return sanitizeHtmlFragment(raw, {
      resolveMediaSrc,
      mediaRenderScope,
    })
  }, [source, raw, resolveMediaSrc, mediaRenderScope, sourceOpen])

  useEffect(() => {
    if (sourceOpen) return
    setSourceDraft(raw)
  }, [raw, sourceOpen])

  const onHtmlBlockDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!editable) return
      setSourceDraft(raw)
      setSourceOpen(true)
    },
    [editable, raw],
  )

  const commitHtmlSource = useCallback(() => {
    const next = sourceDraftRef.current.replace(/\r\n/gu, '\n')
    if (next !== raw) {
      updateAttributes({ content: next })
    }
    setSourceOpen(false)
  }, [raw, updateAttributes])

  useEffect(() => {
    if (!sourceOpen) return
    const next = sourceDraft.replace(/\r\n/gu, '\n')
    if (next !== raw) {
      updateAttributes({ content: next })
    }
  }, [sourceOpen, sourceDraft, raw, updateAttributes])

  const cancelHtmlSource = useCallback(() => {
    setSourceDraft(raw)
    setSourceOpen(false)
  }, [raw])

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

  useLayoutEffect(() => {
    if (source !== 'html' || sourceOpen) return
    const el = surfaceRef.current
    if (!el || el.innerHTML === renderedHtml) return
    el.innerHTML = renderedHtml
  }, [source, sourceOpen, renderedHtml])

  if (source === 'html') {
    const commentBody = parseHtmlCommentBody(raw)
    if (commentBody != null) {
      const commentPlaceholder = t('editor.htmlComment.placeholder')
      const commentTitle = commentBody
        ? t('editor.htmlComment.editTitleWithBody', { body: commentBody })
        : t('editor.htmlComment.editTitleEmpty')
      return (
        <NodeViewWrapper
          as="div"
          className="pm-luna-raw-block pm-luna-html-comment-block"
          data-luna-raw-block="1"
          data-source="html"
          data-type="html-comment-block"
          title={commentTitle}
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
              {commentBody || commentPlaceholder}
              {' -->'}
            </span>
          </div>
        </NodeViewWrapper>
      )
    }
    return (
      <NodeViewWrapper
        as="div"
        className={`pm-luna-raw-block pm-luna-html-block${sourceOpen ? ' pm-luna-html-block--source-open' : ''}`}
        data-luna-raw-block="1"
        data-source="html"
        data-type="html-block"
        title={t('editor.htmlBlock.editTitle')}
        onDoubleClick={sourceOpen ? undefined : onHtmlBlockDoubleClick}
      >
        {sourceOpen ? (
          <LunaHtmlBlockSourceEditor
            value={sourceDraft}
            onChange={setSourceDraft}
            onCommit={commitHtmlSource}
            onCancel={cancelHtmlSource}
          />
        ) : null}
        <div
          ref={surfaceRef}
          className={`pm-luna-html-block-surface${sourceOpen ? ' pm-luna-html-block-surface--hidden' : ''}`}
          contentEditable={false}
          suppressContentEditableWarning
          aria-hidden={sourceOpen}
          onMouseDown={
            sourceOpen || !shouldAttachEmbeddedHtmlMediaMouseDownGuard(raw)
              ? undefined
              : handleEmbeddedHtmlMediaMouseDown
          }
        />
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
    return ReactNodeViewRenderer(LunaRawBlockView, {
      selectedOnTextSelection: false,
      stopEvent: ({ event }) => shouldStopEmbeddedHtmlSurfaceNodeViewEvent(event),
      ignoreMutation: ({ mutation }) => {
        const target = mutation.target
        if (!(target instanceof Node)) return false
        const el = target instanceof Element ? target : target.parentElement
        return !!el?.closest('.pm-luna-html-block-surface, .pm-luna-html-comment-block-surface')
      },
    })
  },

  renderHTML({ node, HTMLAttributes }) {
    const source = normalizeLunaRawSource(node.attrs.source)
    const content = String(node.attrs.content ?? '')
    if (source === 'html') {
      const safeContent = sanitizeEmbeddedHtml(content)
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
