import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
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
import { isAbsoluteLocalMediaPath, isExternalOrDataSrc } from '../export/mediaSources'
import {
  acquireLegacyEncryptedWorkspaceImageObjectUrl,
  acquireWorkspaceImageObjectUrl,
  releaseWorkspaceImageObjectUrl,
  resolveWorkspaceMediaFilePath,
  isWorkspaceMediaDecryptEnabled,
} from '../export/workspaceMediaBlob'
import { useI18n } from '../i18n'
import { readPlainForBlockSourcePaste, readPlainFromBlockSourcePasteEvent } from './blockSourceTextareaPaste'
import { registerBlockSourceDraftSerializeFlush } from './blockSourceDraftSerializeBridge'

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

function imageAttrsMatchDraft(
  parsed: { alt: string; src: string; title: string | null },
  alt: string,
  src: string,
  title: string,
): boolean {
  return (
    parsed.src === src.trim() &&
    parsed.alt === alt &&
    (parsed.title ?? '') === (title || '')
  )
}

const LunaImageView = memo(function LunaImageView(props: ReactNodeViewProps) {
  const { t } = useI18n()
  const { node, updateAttributes, selected, editor, getPos } = props
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const title = node.attrs.title != null ? String(node.attrs.title) : ''
  const isVideo = isEmbeddedVideoSrc(src)
  const { resolveSrc, getNoteAssetContext } = props.extension.options as LunaImageOptions
  const fallbackDisplaySrc = resolveSrc ? resolveSrc(src) : src
  const [workspaceBlobUrl, setWorkspaceBlobUrl] = useState<string | null>(null)
  const [workspaceMediaPending, setWorkspaceMediaPending] = useState(false)
  const displaySrc = workspaceBlobUrl ?? fallbackDisplaySrc
  const loadKey = useMemo(() => imageLoadCacheKey(src, fallbackDisplaySrc), [src, fallbackDisplaySrc])

  const [loadError, setLoadError] = useState(() => globalFailedImageLoadKeys.has(loadKey))
  const [showBar, setShowBar] = useState(false)
  const [textDraft, setTextDraft] = useState(() => mdImageSnippet(alt, src, title))
  const textDraftRef = useRef(textDraft)
  const showBarRef = useRef(showBar)
  const [assetPresence, setAssetPresence] = useState<'skip' | 'pending' | 'exists' | 'missing'>('skip')
  const [tableEmbed, setTableEmbed] = useState(false)
  const wrapRef = useRef<HTMLElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const sourceInputRef = useRef<HTMLTextAreaElement | null>(null)
  const legacyFallbackAttemptedRef = useRef(false)
  const workspaceBlobPathRef = useRef<{ root: string; path: string } | null>(null)

  const releaseTrackedWorkspaceBlob = useCallback(() => {
    const tracked = workspaceBlobPathRef.current
    if (!tracked) return
    releaseWorkspaceImageObjectUrl(tracked.root, tracked.path)
    workspaceBlobPathRef.current = null
  }, [])

  useEffect(() => {
    if (isVideo) {
      setWorkspaceMediaPending(false)
      setWorkspaceBlobUrl(null)
      return
    }
    const raw = src.trim()
    if (!raw || isExternalOrDataSrc(raw) || isAbsoluteLocalMediaPath(raw)) {
      setWorkspaceMediaPending(false)
      setWorkspaceBlobUrl(null)
      return
    }
    const ctx = getNoteAssetContext?.() ?? null
    if (!isWorkspaceMediaDecryptEnabled() || !ctx) {
      setWorkspaceMediaPending(false)
      setWorkspaceBlobUrl(null)
      return
    }
    const workspacePath = resolveWorkspaceMediaFilePath(ctx.root, ctx.notePath, raw)
    if (!workspacePath) {
      setWorkspaceMediaPending(false)
      setWorkspaceBlobUrl(null)
      return
    }

    let cancelled = false
    releaseTrackedWorkspaceBlob()
    setWorkspaceMediaPending(true)
    setWorkspaceBlobUrl(null)
    void (async () => {
      const objectUrl = await acquireWorkspaceImageObjectUrl(ctx.root, workspacePath)
      if (cancelled) {
        if (objectUrl) releaseWorkspaceImageObjectUrl(ctx.root, workspacePath)
        return
      }
      if (objectUrl) {
        workspaceBlobPathRef.current = { root: ctx.root, path: workspacePath }
      }
      setWorkspaceBlobUrl(objectUrl)
      setWorkspaceMediaPending(false)
      if (objectUrl) {
        globalFailedImageLoadKeys.delete(loadKey)
        setLoadError(false)
      }
    })()

    return () => {
      cancelled = true
      releaseTrackedWorkspaceBlob()
      setWorkspaceMediaPending(false)
      setWorkspaceBlobUrl(null)
    }
  }, [src, isVideo, getNoteAssetContext, loadKey, releaseTrackedWorkspaceBlob])

  useEffect(() => {
    legacyFallbackAttemptedRef.current = false
  }, [src, loadKey])

  const tryLegacyEncryptedImageFallback = useCallback(async () => {
    if (legacyFallbackAttemptedRef.current || isVideo) return false
    const raw = src.trim()
    if (!raw || isExternalOrDataSrc(raw) || isAbsoluteLocalMediaPath(raw)) return false
    const ctx = getNoteAssetContext?.() ?? null
    if (!ctx) return false
    const workspacePath = resolveWorkspaceMediaFilePath(ctx.root, ctx.notePath, raw)
    if (!workspacePath) return false
    legacyFallbackAttemptedRef.current = true
    setWorkspaceMediaPending(true)
    const objectUrl = await acquireLegacyEncryptedWorkspaceImageObjectUrl(ctx.root, workspacePath)
    if (!objectUrl) {
      setWorkspaceMediaPending(false)
      return false
    }
    releaseTrackedWorkspaceBlob()
    workspaceBlobPathRef.current = { root: ctx.root, path: workspacePath }
    setWorkspaceBlobUrl(objectUrl)
    setWorkspaceMediaPending(false)
    globalFailedImageLoadKeys.delete(loadKey)
    setLoadError(false)
    return true
  }, [src, isVideo, getNoteAssetContext, loadKey, releaseTrackedWorkspaceBlob])

  useLayoutEffect(() => {
    setLoadError(globalFailedImageLoadKeys.has(loadKey))
  }, [loadKey, workspaceBlobUrl])

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
    if (!ctx) {
      setAssetPresence('skip')
      return
    }
    // Fast path: relative images load via convertFileSrc; skip per-image asset existence IPC.
    setAssetPresence('skip')
  }, [src, isVideo, getNoteAssetContext])

  useLayoutEffect(() => {
    const detectTableEmbed = (): boolean => {
      const el = wrapRef.current
      if (!el) return false
      const cell = el.closest('td, th')
      const tableWrap = el.closest('.pm-luna-table-wrap')
      return Boolean(cell && tableWrap)
    }
    setTableEmbed(detectTableEmbed())
    const raf = requestAnimationFrame(() => setTableEmbed(detectTableEmbed()))
    return () => cancelAnimationFrame(raf)
  }, [src, assetPresence, loadError])

  const markImageFailed = useCallback(() => {
    rememberFailedImageKey(loadKey)
    setLoadError(true)
  }, [loadKey])

  const showMdSource = assetPresence === 'missing' || loadError
  const snippet = useMemo(() => mdImageSnippet(alt, src, title), [alt, src, title])

  /** Table icons stay compact: skip pending chrome and open-card layout churn. */
  const resolvedAssetPresence =
    tableEmbed && assetPresence === 'pending' ? ('skip' as const) : assetPresence
  const cardReady = resolvedAssetPresence !== 'pending'
  const showSourcePanel = cardReady && showBar
  const showPendingUi = resolvedAssetPresence === 'pending' || workspaceMediaPending

  const prevShowBarRef = useRef(false)

  /** Prevent WebKit from painting ::selection over img alt / inline paragraph text when clicking the card. */
  const onPreviewMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).closest('.pm-image-card-source-input')) return

      e.preventDefault()
      e.stopPropagation()

      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos !== 'number') return

      const { selection } = editor.state
      const alreadySelected =
        selection instanceof NodeSelection && selection.from === pos

      if (!alreadySelected) {
        editor.chain().focus(undefined, { scrollIntoView: false }).setNodeSelection(pos).run()
      }

      document.getSelection()?.removeAllRanges()
    },
    [editor, getPos],
  )

  const commitSnippet = useCallback(() => {
    const parsed = parseMarkdownImageLine(textDraft)
    if (!parsed) {
      setTextDraft(mdImageSnippet(alt, src, title))
      return
    }
    if (imageAttrsMatchDraft(parsed, alt, src, title)) return
    updateAttributes({
      alt: parsed.alt,
      src: parsed.src,
      title: parsed.title,
    })
  }, [textDraft, alt, src, title, updateAttributes])

  const applyDraftToNodeAttrs = useCallback(
    (draft: string): boolean => {
      const parsed = parseMarkdownImageLine(draft)
      if (!parsed) return false
      if (imageAttrsMatchDraft(parsed, alt, src, title)) return true
      updateAttributes({
        alt: parsed.alt,
        src: parsed.src,
        title: parsed.title,
      })
      return true
    },
    [alt, src, title, updateAttributes],
  )

  textDraftRef.current = textDraft
  showBarRef.current = showBar

  const flushImageSyntaxDraftForSerialize = useCallback(() => {
    if (!showBarRef.current) return
    applyDraftToNodeAttrs(textDraftRef.current)
  }, [applyDraftToNodeAttrs])

  useEffect(() => {
    return registerBlockSourceDraftSerializeFlush(props.editor, flushImageSyntaxDraftForSerialize)
  }, [props.editor, flushImageSyntaxDraftForSerialize])

  useEffect(() => {
    if (!showBar) return
    applyDraftToNodeAttrs(textDraft)
  }, [showBar, textDraft, applyDraftToNodeAttrs])

  const adjustSourceHeight = useCallback(() => {
    const el = sourceInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(24, el.scrollHeight)}px`
  }, [])

  const insertSourceDraftText = useCallback(
    (text: string, selectionStart: number, selectionEnd: number) => {
      const next = `${textDraft.slice(0, selectionStart)}${text}${textDraft.slice(selectionEnd)}`
      setTextDraft(next)
      applyDraftToNodeAttrs(next)
      const caret = selectionStart + text.length
      requestAnimationFrame(() => {
        adjustSourceHeight()
        sourceInputRef.current?.setSelectionRange(caret, caret)
      })
    },
    [adjustSourceHeight, applyDraftToNodeAttrs, textDraft],
  )

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
      applyDraftToNodeAttrs(textDraft)
      setShowBar(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [applyDraftToNodeAttrs, showBar, showSourcePanel, textDraft])

  useLayoutEffect(() => {
    if (isVideo || loadError || showMdSource || resolvedAssetPresence === 'pending') return
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
  }, [displaySrc, isVideo, loadError, showMdSource, resolvedAssetPresence, markImageFailed])

  const shouldMountImg =
    resolvedAssetPresence !== 'pending' &&
    resolvedAssetPresence !== 'missing' &&
    !workspaceMediaPending &&
    !loadError &&
    Boolean(displaySrc.trim())

  if (isVideo) {
    const altLabel = alt || t('editor.video.defaultAlt')
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

  const cardOpen = cardReady && !tableEmbed

  return (
    <NodeViewWrapper
      as="span"
      className={`pm-image-node-root pm-image-card${tableEmbed ? ' pm-image-card--table-embed' : ''}${cardOpen ? ' pm-image-card--open' : ''}${showSourcePanel ? ' pm-image-card--source-open' : ''}${selected || showBar ? ' pm-image-card--focus' : ''}`}
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
            onPaste={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const ta = event.currentTarget
              const start = ta.selectionStart ?? ta.value.length
              const end = ta.selectionEnd ?? start
              const plainSync = readPlainFromBlockSourcePasteEvent(event.clipboardData)
              if (plainSync) {
                insertSourceDraftText(plainSync, start, end)
                return
              }
              void (async () => {
                const plain = await readPlainForBlockSourcePaste(event.clipboardData)
                if (!plain) return
                insertSourceDraftText(plain, start, end)
              })()
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
      {showPendingUi ? (
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
                void (async () => {
                  const recovered = await tryLegacyEncryptedImageFallback()
                  if (!recovered) markImageFailed()
                })()
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
                  {alt ? <span className="pm-image-broken-placeholder-meta">{t('editor.image.altMeta', { alt })}</span> : null}
                </>
              ) : loadError ? (
                <>
                  <span className="pm-image-broken-placeholder-title">{t('editor.image.loadFailed')}</span>
                  {alt ? <span className="pm-image-broken-placeholder-meta">{t('editor.image.altMeta', { alt })}</span> : null}
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
