import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import DOMPurify from 'dompurify'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '../../design-system/icons'
import { useI18n } from '../../i18n'
import { markdownToHtmlFragment } from '../../export/markdownPipeline'
import { getDocumentMeta } from '../../editor/knowledgeRuntime'
import { resolveWikiTarget } from '../../editor/knowledgeOS/wikiLinkRuntime'
import { loadNoteContent } from '../../editor/knowledgeOS/vaultRuntime'
import { useOsRevision } from '../../editor/knowledgeOS/ui/useKnowledgeOSSlice'
import { LUNA_EMBEDDED_HTML_PURIFY } from '../../editor/lunaHtmlSanitize'
import { sliceEmbedMarkdownBody } from '../../editor/wikiEmbedContent'
import { hydrateDrawingPreviewsInContainer } from '../../editor/wikiEmbedDrawingHydration'
import { resolveMarkdownMediaSrc, buildMediaSourceResolveOptions } from '../../export/mediaSources'
import { isImageEmbedTarget } from '../../editor/wikiEmbedParse'
import { asMetadataResolvedTarget, dispatchKnowledgeNavigate } from '../../editor/knowledgeOS/ui/interactionTransaction'

type WikiEmbedAttrs = {
  raw?: string
  docKey?: string
  heading?: string | null
  blockId?: string | null
  alias?: string | null
  collapsed?: boolean
}

function embedLabel(title: string, heading?: string | null, blockId?: string | null): string {
  const parts = [title]
  if (heading) parts.push(`#${heading}`)
  if (blockId) parts.push(`^${blockId}`)
  return parts.join(' ')
}

/** Keep ProseMirror from starting a native text selection when clicking embed chrome controls. */
function suppressChromePointer(event: React.MouseEvent | React.PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

export const WikiEmbedView = memo(function WikiEmbedView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor } = props
  const { t } = useI18n()
  const attrs = node.attrs as WikiEmbedAttrs
  const raw = String(attrs.raw ?? '')
  const docKey = String(attrs.docKey ?? '')
  const heading = attrs.heading ? String(attrs.heading) : undefined
  const blockId = attrs.blockId ? String(attrs.blockId) : undefined
  const alias = attrs.alias ? String(attrs.alias) : undefined
  const collapsed = Boolean(attrs.collapsed)
  const isInlineHost = node.type.name === 'wikiEmbedInline'
  const editable = editor.isEditable
  const osRevision = useOsRevision()

  const target = useMemo(
    () =>
      resolveWikiTarget({
        docKey,
        heading,
        blockId,
        alias,
      }),
    [alias, blockId, docKey, heading],
  )

  const embeddedContentRevision = useMemo(() => {
    void osRevision
    const key = target.resolvedDocKey ?? docKey
    if (!key) return ''
    return getDocumentMeta(key)?.contentHash ?? ''
  }, [docKey, osRevision, target.resolvedDocKey])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState('')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!docKey) {
        setError('missing-target')
        setHtml('')
        setImageSrc(null)
        return
      }
      if (!target.exists || !target.absolutePath) {
        setError('unresolved')
        setHtml('')
        setImageSrc(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const markdown = await loadNoteContent(target.resolvedDocKey ?? docKey, target.absolutePath)
        if (cancelled) return
        if (isImageEmbedTarget(docKey)) {
          const mediaOpts = buildMediaSourceResolveOptions(null)
          const displaySrc = resolveMarkdownMediaSrc(docKey, target.absolutePath, mediaOpts)
          const resolved =
            displaySrc ||
            (isTauri() ? convertFileSrc(target.absolutePath) : `file://${target.absolutePath}`)
          setImageSrc(resolved)
          setHtml('')
          return
        }
        const slice = sliceEmbedMarkdownBody(markdown, { heading, blockId })
        const fragment = await markdownToHtmlFragment(slice, { useAppTheme: true })
        const safe = DOMPurify.sanitize(fragment, LUNA_EMBEDDED_HTML_PURIFY) as string
        if (!cancelled) {
          setHtml(safe)
          setImageSrc(null)
        }
      } catch {
        if (!cancelled) {
          setError('load-failed')
          setHtml('')
          setImageSrc(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    blockId,
    docKey,
    embeddedContentRevision,
    heading,
    osRevision,
    target.absolutePath,
    target.exists,
    target.resolvedDocKey,
  ])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || collapsed) return
    if (!html) {
      surface.innerHTML = ''
      return
    }
    surface.innerHTML = html
    hydrateDrawingPreviewsInContainer(surface)
  }, [collapsed, html])

  const title = embedLabel(alias || target.displayLabel, heading, blockId)

  const toggleCollapsed = useCallback(() => {
    updateAttributes({ collapsed: !collapsed })
  }, [collapsed, updateAttributes])

  const onCollapsePointerDown = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    suppressChromePointer(event)
  }, [])

  const onCollapseClick = useCallback(
    (event: React.MouseEvent) => {
      suppressChromePointer(event)
      toggleCollapsed()
    },
    [toggleCollapsed],
  )

  const onTitlePointerDown = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    suppressChromePointer(event)
  }, [])

  const onTitleClick = useCallback(
    (event: React.MouseEvent) => {
      suppressChromePointer(event)
      if (!target.resolvedDocKey) return
      dispatchKnowledgeNavigate(
        'editor',
        asMetadataResolvedTarget(
          {
            docKey: target.resolvedDocKey,
            heading,
            blockId,
          },
          'metadata',
        ),
      )
    },
    [blockId, heading, target.resolvedDocKey],
  )

  const onChromePointerDown = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    suppressChromePointer(event)
  }, [])

  const onSurfaceCopy = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const selected = window.getSelection()?.toString() ?? ''
    if (!selected.trim()) return
    event.clipboardData?.setData('text/plain', selected)
    event.preventDefault()
  }, [])

  return (
    <NodeViewWrapper
      as={isInlineHost ? 'span' : 'div'}
      className={`pm-wiki-embed-root${isInlineHost ? ' pm-wiki-embed-root--inline' : ''}${collapsed ? ' pm-wiki-embed-root--collapsed' : ''}${error ? ' pm-wiki-embed-root--error' : ''}`}
      data-wiki-embed-root="1"
      data-wiki-embed-collapsed={collapsed ? '1' : '0'}
    >
      <div className="pm-wiki-embed-chrome" contentEditable={false} onMouseDown={onChromePointerDown}>
        <div className="pm-wiki-embed-chrome-main">
          {editable ? (
            <button
              type="button"
              className="pm-wiki-embed-collapse"
              aria-expanded={!collapsed}
              aria-label={collapsed ? t('editor.wikiEmbed.expand') : t('editor.wikiEmbed.collapse')}
              onMouseDown={onCollapsePointerDown}
              onClick={onCollapseClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleCollapsed()
                }
              }}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size="xs" stroke="strong" />
            </button>
          ) : null}
          <button
            type="button"
            className="pm-wiki-embed-title"
            onMouseDown={onTitlePointerDown}
            onClick={onTitleClick}
            disabled={!target.resolvedDocKey}
          >
            {title}
          </button>
        </div>
        <code className="pm-wiki-embed-raw">{raw}</code>
      </div>
      {!collapsed ? (
        <>
          {loading ? <div className="pm-wiki-embed-status">…</div> : null}
          {error === 'unresolved' ? (
            <div className="pm-wiki-embed-status">{t('editor.wikiEmbed.unresolved')}</div>
          ) : null}
          {error === 'load-failed' ? (
            <div className="pm-wiki-embed-status">{t('editor.wikiEmbed.loadFailed')}</div>
          ) : null}
          {imageSrc ? (
            <div className="pm-wiki-embed-image-wrap">
              <img className="pm-wiki-embed-image" src={imageSrc} alt={title} draggable={false} />
            </div>
          ) : html || (!loading && !error) ? (
            <div
              ref={surfaceRef}
              className="pm-wiki-embed-surface markdown-body"
              data-wiki-embed-surface="1"
              contentEditable={false}
              suppressContentEditableWarning
              onCopy={onSurfaceCopy}
            />
          ) : null}
        </>
      ) : null}
    </NodeViewWrapper>
  )
})
