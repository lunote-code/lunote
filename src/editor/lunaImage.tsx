import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { isTauri } from '@tauri-apps/api/core'
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
import { isAbsoluteLocalMediaPath, isExternalOrDataSrc } from '../export/mediaSources'
import { useI18n } from '../i18n'
import { noteAssetExists } from '../platform/tauri/documentService'

const VIDEO_PATH_RE = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i

const MAX_FAILED_IMAGE_KEYS = 256
const globalFailedImageLoadKeys = new Set<string>()

/** Use "src in the document + actual requested URL" to distinguish relative path parsing results to avoid repeatedly hitting failed URLs after remounting.*/
function imageLoadCacheKey(rawSrc: string, resolvedSrc: string): string {
  return `raw:${rawSrc.trim()}\nres:${resolvedSrc.trim()}`
}

function rememberFailedImageKey(key: string): void {
  if (globalFailedImageLoadKeys.has(key)) return
  if (globalFailedImageLoadKeys.size >= MAX_FAILED_IMAGE_KEYS) {
    const first = globalFailedImageLoadKeys.values().next().value as string | undefined
    if (first != null) globalFailedImageLoadKeys.delete(first)
  }
  globalFailedImageLoadKeys.add(key)
}
type LunaImageOptions = {
  resolveSrc?: (src: string) => string
  /** Tauri is used to detect whether the relative resource is on the disk; if the buffer page, etc. returns null, the detection will be skipped.*/
  getNoteAssetContext?: () => { root: string; notePath: string } | null
}

export function isEmbeddedVideoSrc(src: string | null | undefined): boolean {
  if (!src) return false
  const s = String(src).trim()
  if (/^data:video\//i.test(s)) return true
  const pathOnly = s.split(/[?#]/u)[0] || s
  return VIDEO_PATH_RE.test(pathOnly)
}

function escapeMdAlt(alt: string): string {
  return alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
}

function escapeMdTitle(title: string): string {
  return title.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')
}

/** Consistent with CommonMark: `![alt](url)` or `![alt](url "title")`*/
function mdImageSnippet(
  alt: string | null | undefined,
  src: string | null | undefined,
  title?: string | null,
): string {
  const a = escapeMdAlt(String(alt ?? ''))
  const s = String(src ?? '').trim()
  const t = title != null ? String(title).trim() : ''
  const base = `![${a}](${s})`
  if (t) return `${base} "${escapeMdTitle(t)}"`
  return base
}

function parseMarkdownImageLine(line: string): { alt: string; src: string; title: string | null } | null {
  const t = line.trim()
  const m = t.match(/^!\[([\s\S]*?)\]\(\s*([^)\s]+)\s*(?:\s+"((?:\\.|[^"])*)")?\s*\)$/u)
  if (!m) return null
  const alt = m[1].replace(/\\\]/gu, ']').replace(/\\\[/gu, '[').replace(/\\\\/gu, '\\')
  const titleRaw = m[3]
  const title =
    titleRaw != null && titleRaw.length > 0
      ? titleRaw.replace(/\\"/gu, '"').replace(/\\\\/gu, '\\')
      : null
  return { alt, src: m[2].trim(), title }
}

const LunaImageView = memo(function LunaImageView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { node, updateAttributes, selected } = props
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const title = node.attrs.title != null ? String(node.attrs.title) : ''
  const isVideo = isEmbeddedVideoSrc(src)
  const { resolveSrc, getNoteAssetContext } = props.extension.options as LunaImageOptions
  const displaySrc = resolveSrc ? resolveSrc(src) : src
  const loadKey = useMemo(() => imageLoadCacheKey(src, displaySrc), [src, displaySrc])

  const [loadError, setLoadError] = useState(() => globalFailedImageLoadKeys.has(loadKey))
  const [showBar, setShowBar] = useState(false)
  const [textDraft, setTextDraft] = useState(() => mdImageSnippet(alt, src, title))
  const [assetPresence, setAssetPresence] = useState<'skip' | 'pending' | 'exists' | 'missing'>('skip')
  const wrapRef = useRef<HTMLElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const sourceInputRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    setLoadError(globalFailedImageLoadKeys.has(loadKey))
  }, [loadKey])

  useEffect(() => {
    setTextDraft(mdImageSnippet(alt, src, title))
  }, [alt, src, title])

  useEffect(() => {
    if (isVideo) {
      setAssetPresence('skip')
      return
    }
    const raw = src.trim()
    if (!raw) {
      setAssetPresence('skip')
      return
    }
    if (isExternalOrDataSrc(raw) || isAbsoluteLocalMediaPath(raw)) {
      setAssetPresence('skip')
      return
    }
    const ctx = getNoteAssetContext?.() ?? null
    if (!isTauri() || !ctx) {
      setAssetPresence('skip')
      return
    }
    let cancelled = false
    setAssetPresence('pending')
    void (async () => {
      try {
        const relativePath = raw.replace(/^\.\//u, '')
        const exists = await noteAssetExists(ctx.root, ctx.notePath, relativePath)
        if (!cancelled) setAssetPresence(exists ? 'exists' : 'missing')
      } catch {
        if (!cancelled) setAssetPresence('exists')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [src, isVideo, getNoteAssetContext])

  const markImageFailed = useCallback(() => {
    rememberFailedImageKey(loadKey)
    setLoadError(true)
  }, [loadKey])

  const showMdSource = assetPresence === 'missing' || loadError
  const snippet = useMemo(() => mdImageSnippet(alt, src, title), [alt, src, title])

  /** Card chrome always on; Markdown source bar only after double-click. */
  const cardReady = assetPresence !== 'pending'
  const showSourcePanel = cardReady && showBar

  const prevShowBarRef = useRef(false)

  /** Prevent WebKit from painting ::selection over img alt / inline paragraph text when clicking the card. */
  const onPreviewMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).closest('.pm-image-card-source-input')) return

      e.preventDefault()
      e.stopPropagation()

      const getPos = props.getPos
      if (typeof getPos !== 'function') return
      const pos = getPos()
      if (typeof pos !== 'number') return

      const { editor } = props
      const { selection } = editor.state
      const alreadySelected =
        selection instanceof NodeSelection && selection.from === pos

      if (!alreadySelected) {
        editor.chain().focus(undefined, { scrollIntoView: false }).setNodeSelection(pos).run()
      }

      document.getSelection()?.removeAllRanges()
    },
    [props.editor, props.getPos],
  )

  const commitSnippet = useCallback(() => {
    const parsed = parseMarkdownImageLine(textDraft)
    if (!parsed) {
      setTextDraft(mdImageSnippet(alt, src, title))
      return
    }
    updateAttributes({
      alt: parsed.alt,
      src: parsed.src,
      title: parsed.title,
    })
  }, [textDraft, alt, src, title, updateAttributes])

  const adjustSourceHeight = useCallback(() => {
    const el = sourceInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(24, el.scrollHeight)}px`
  }, [])

  useLayoutEffect(() => {
    if (!showSourcePanel) return
    adjustSourceHeight()
  }, [showSourcePanel, textDraft, adjustSourceHeight])

  useEffect(() => {
    const opened = showBar && !prevShowBarRef.current
    prevShowBarRef.current = showBar
    if (!opened) return
    const id = window.requestAnimationFrame(() => sourceInputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [showBar])

  useEffect(() => {
    if (!showBar) return
    const editor = props.editor
    const onSelectionUpdate = () => {
      if (sourceInputRef.current === document.activeElement) return
      if (selected) return
      setShowBar(false)
    }
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [showBar, selected, props.editor])

  useEffect(() => {
    if (!showBar && !showSourcePanel) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (wrapRef.current?.contains(t)) return
      setShowBar(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [showBar, showSourcePanel])

  useLayoutEffect(() => {
    if (isVideo || loadError || showMdSource || assetPresence === 'pending') return
    const el = imgRef.current
    if (!el || !displaySrc) return
    let cancelled = false
    const markBrokenIfStillBad = () => {
      if (cancelled) return
      if (el.complete && el.naturalWidth === 0) markImageFailed()
    }
    const t = window.setTimeout(markBrokenIfStillBad, 2500)
    void el
      .decode()
      .then(() => {
        if (!cancelled) markBrokenIfStillBad()
      })
      .catch(() => {
        if (!cancelled) markBrokenIfStillBad()
      })
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [displaySrc, isVideo, loadError, showMdSource, assetPresence, markImageFailed])

  const shouldMountImg =
    assetPresence !== 'pending' &&
    assetPresence !== 'missing' &&
    !loadError &&
    Boolean(displaySrc.trim())

  if (isVideo) {
    const altLabel = alt || 'Video'
    return (
      <NodeViewWrapper
        as="div"
        className="pm-media-block pm-video-block"
        data-type="embed-video"
        ref={wrapRef}
      >
        <video
          src={displaySrc}
          controls
          playsInline
          preload="metadata"
          aria-label={altLabel}
          title={title || undefined}
        />
      </NodeViewWrapper>
    )
  }

  const cardOpen = cardReady

  return (
    <NodeViewWrapper
      as="span"
      className={`pm-image-node-root pm-image-card${cardOpen ? ' pm-image-card--open' : ''}${showSourcePanel ? ' pm-image-card--source-open' : ''}${selected || showBar ? ' pm-image-card--focus' : ''}`}
      ref={wrapRef}
      contentEditable={false}
    >
      {showSourcePanel ? (
        <div
          className="pm-image-card-source"
          contentEditable={false}
          onMouseDown={(e: ReactMouseEvent<HTMLElement>) => e.stopPropagation()}
        >
          <textarea
            ref={sourceInputRef}
            className="pm-image-card-source-input"
            value={textDraft}
            spellCheck={false}
            rows={1}
            aria-label={t('editor.image.syntaxAria')}
            onChange={(e) => {
              setTextDraft(e.target.value)
              requestAnimationFrame(() => adjustSourceHeight())
            }}
            onBlur={() => {
              commitSnippet()
              setShowBar(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setTextDraft(snippet)
                setShowBar(false)
                e.currentTarget.blur()
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitSnippet()
                setShowBar(false)
                props.editor.commands.focus()
              }
            }}
          />
        </div>
      ) : null}
      {assetPresence === 'pending' ? (
        <div
          className="pm-image-card-preview pm-image-card-preview--pending"
          onMouseDown={onPreviewMouseDown}
        >
          <span className="pm-image-pending-line" aria-live="polite">
            {t('editor.image.checkingPending')}
          </span>
        </div>
      ) : (
        <div className="pm-image-card-preview" onMouseDown={onPreviewMouseDown}>
          {shouldMountImg ? (
            <img
              ref={imgRef}
              className="pm-markdown-image-preview pm-image-block-img"
              src={displaySrc}
              alt={alt}
              title={title || undefined}
              decoding="async"
              draggable={false}
              onMouseDown={onPreviewMouseDown}
              onDoubleClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setShowBar(true)
              }}
              onError={() => {
                markImageFailed()
              }}
              onLoad={() => {
                if (imgRef.current && imgRef.current.naturalWidth === 0) markImageFailed()
              }}
            />
          ) : (
            <div
              className="pm-image-broken-placeholder"
              role="img"
              aria-label={
                loadError
                  ? t('editor.image.loadFailedAria', { alt: alt || displaySrc || t('editor.image.noAddress') })
                  : undefined
              }
              onMouseDown={onPreviewMouseDown}
              onDoubleClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setShowBar(true)
              }}
            >
              {assetPresence === 'missing' ? (
                <>
                  <span className="pm-image-broken-placeholder-title">{t('editor.image.missingLocal')}</span>
                  {alt? <span className="pm-image-broken-placeholder-meta">alt：{alt}</span> : null}
                </>
              ) : loadError ? (
                <>
                  <span className="pm-image-broken-placeholder-title">{t('editor.image.loadFailed')}</span>
                  {alt? <span className="pm-image-broken-placeholder-meta">alt：{alt}</span> : null}
                </>
              ) : (
                <span className="pm-image-broken-placeholder-title">{t('editor.image.noAddress')}</span>
              )}
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
})

export const LunaImage = Image.extend({
  name: 'image',
  /** Turn off the HTML5 drag and drop of the entire node to avoid accidentally dragging to the sidebar/file tree and causing the"+" copy cursor and abnormal drag and drop.*/
  draggable: false,

  addOptions() {
    return {
      //Must be inline: the image in CommonMark is in inline of the paragraph, prosemirror-markdown
      //Unable to put the block image into the paragraph (createAndFill failed causing the image to be silently discarded).
      inline: true,
      allowBase64: true,
      HTMLAttributes: {},
      resize: false as const,
      getNoteAssetContext: undefined as LunaImageOptions['getNoteAssetContext'],
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(LunaImageView)
  },

  parseHTML() {
    return [
      ...(this.options.allowBase64
        ? [{ tag: 'img[src]' as const }]
        : [{ tag: 'img[src]:not([src^="data:"])' as const }]),
      {
        tag: 'video[src]',
        getAttrs: (el: HTMLElement) => ({
          src: el.getAttribute('src'),
          alt: el.getAttribute('aria-label') || el.getAttribute('title') || 'Video',
          title: el.getAttribute('title'),
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const s = node.attrs.src as string | null | undefined
    if (isEmbeddedVideoSrc(s)) {
      const alt = String(node.attrs.alt || 'Video')
      return [
        'div',
        mergeAttributes(
          { class: 'pm-media-block pm-video-block', 'data-type': 'embed-video' },
          this.options.HTMLAttributes,
        ),
        [
          'video',
          mergeAttributes(
            {
              src: String(s),
              controls: true,
              playsInline: true,
              preload: 'metadata',
              'aria-label': alt,
            },
            { title: node.attrs.title ? String(node.attrs.title) : undefined },
          ),
        ],
      ]
    }
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'pm-image-block-img',
      }),
    ]
  },
})
