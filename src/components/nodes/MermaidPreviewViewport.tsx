import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'

import { useI18n } from '../../i18n'
import { resolveOverlayPortalRoot } from '../../lib/overlayPortalRoot'
import { RUNTIME_SURFACE_CLASS } from '../../editor/runtimeEngine/unified'
import {
  clampMermaidPreviewZoom,
  formatMermaidPreviewZoomLabel,
  MERMAID_PREVIEW_DEFAULT_ZOOM,
  MERMAID_PREVIEW_ZOOM_STEP,
} from './mermaidPreviewZoom'
import { scaledMermaidStageSize, type MermaidContentSize } from './mermaidPreviewStage'
import { useMermaidContentSize } from './useMermaidContentSize'
import { useMermaidGestureZoom } from './useMermaidGestureZoom'
import { useMermaidScrollPan } from './useMermaidScrollPan'

type Props = {
  blockId: string
  hostRef: Ref<HTMLDivElement | null>
  disabled?: boolean
  title: string
  hidden?: boolean
  /** Bumps when preview SVG content may have changed (source/render state). */
  svgRevision?: string
}

function stopPmPropagation(event: ReactMouseEvent): void {
  event.stopPropagation()
}

function stopPmPointer(event: ReactMouseEvent): void {
  event.stopPropagation()
  event.preventDefault()
}

function mergeRefs<T>(a: Ref<T | null>, b: Ref<T | null>): (node: T | null) => void {
  return (node) => {
    if (typeof a === 'function') a(node)
    else if (a && typeof a === 'object') (a as { current: T | null }).current = node
    if (typeof b === 'function') b(node)
    else if (b && typeof b === 'object') (b as { current: T | null }).current = node
  }
}

type ZoomControlsProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onExpand?: () => void
  expandDisabled?: boolean
  className?: string
}

function MermaidPreviewZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onExpand,
  expandDisabled,
  className = '',
}: ZoomControlsProps) {
  const { t } = useI18n()
  return (
    <div
      className={['pm-mermaid-preview-controls', className].filter(Boolean).join(' ')}
      onMouseDown={stopPmPointer}
    >
      <button
        type="button"
        className="pm-mermaid-preview-control-btn"
        data-testid="pm-mermaid-zoom-out"
        aria-label={t('editor.mermaid.zoomOut')}
        onClick={onZoomOut}
      >
        −
      </button>
      <button
        type="button"
        className="pm-mermaid-preview-control-btn pm-mermaid-preview-control-btn--label"
        data-testid="pm-mermaid-zoom-reset"
        aria-label={t('editor.mermaid.zoomReset')}
        onClick={onReset}
      >
        {formatMermaidPreviewZoomLabel(zoom)}
      </button>
      <button
        type="button"
        className="pm-mermaid-preview-control-btn"
        data-testid="pm-mermaid-zoom-in"
        aria-label={t('editor.mermaid.zoomIn')}
        onClick={onZoomIn}
      >
        +
      </button>
      {onExpand ? (
        <button
          type="button"
          className="pm-mermaid-preview-control-btn pm-mermaid-preview-control-btn--expand"
          data-testid="pm-mermaid-expand"
          aria-label={t('editor.mermaid.expandPreview')}
          disabled={expandDisabled}
          onClick={onExpand}
        >
          ⤢
        </button>
      ) : null}
    </div>
  )
}

type MermaidZoomStageProps = {
  zoom: number
  size: MermaidContentSize | null
  stageClassName: string
  hostRef: Ref<HTMLDivElement | null>
  hostClassName: string
}

function MermaidZoomStage({ zoom, size, stageClassName, hostRef, hostClassName }: MermaidZoomStageProps) {
  const scaledSize = scaledMermaidStageSize(size, zoom)
  return (
    <div
      className={stageClassName}
      style={
        scaledSize
          ? {
              width: `${scaledSize.width}px`,
              height: `${scaledSize.height}px`,
            }
          : undefined
      }
    >
      <div
        className="pm-mermaid-zoom-stage-inner"
        style={
          size
            ? {
                width: `${size.width}px`,
                height: `${size.height}px`,
                transform: `scale(${zoom})`,
              }
            : { transform: `scale(${zoom})` }
        }
      >
        <div ref={hostRef} className={hostClassName} />
      </div>
    </div>
  )
}

export const MermaidPreviewViewport = memo(function MermaidPreviewViewport({
  blockId,
  hostRef,
  disabled = false,
  title,
  hidden = false,
  svgRevision = '',
}: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const lightboxHostRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const lightboxScrollRef = useRef<HTMLDivElement | null>(null)
  const lastGestureAtRef = useRef(0)
  const [zoom, setZoom] = useState(MERMAID_PREVIEW_DEFAULT_ZOOM)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState(MERMAID_PREVIEW_DEFAULT_ZOOM)
  const previewSize = useMermaidContentSize(previewHostRef, svgRevision)
  const lightboxSize = useMermaidContentSize(lightboxHostRef, lightboxOpen ? svgRevision : '')

  useEffect(() => {
    setZoom(MERMAID_PREVIEW_DEFAULT_ZOOM)
    setLightboxOpen(false)
    setLightboxZoom(MERMAID_PREVIEW_DEFAULT_ZOOM)
  }, [blockId])

  const syncLightboxMarkup = useCallback(() => {
    const source = previewHostRef.current
    const target = lightboxHostRef.current
    if (!source || !target) return
    target.innerHTML = source.innerHTML
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return
    syncLightboxMarkup()
  }, [lightboxOpen, syncLightboxMarkup, svgRevision])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxOpen])

  const bumpZoom = useCallback((delta: number, scope: 'preview' | 'lightbox') => {
    const apply = scope === 'preview' ? setZoom : setLightboxZoom
    apply((prev) => clampMermaidPreviewZoom(prev + delta))
  }, [])

  const resetZoom = useCallback((scope: 'preview' | 'lightbox') => {
    const apply = scope === 'preview' ? setZoom : setLightboxZoom
    apply(MERMAID_PREVIEW_DEFAULT_ZOOM)
  }, [])

  const applyPreviewZoom = useCallback((value: number) => {
    setZoom(clampMermaidPreviewZoom(value))
  }, [])

  const applyLightboxZoom = useCallback((value: number) => {
    setLightboxZoom(clampMermaidPreviewZoom(value))
  }, [])

  const markGesture = useCallback(() => {
    lastGestureAtRef.current = Date.now()
  }, [])

  useMermaidGestureZoom(previewScrollRef, zoom, applyPreviewZoom, {
    disabled,
    onGestureStart: markGesture,
  })

  useMermaidGestureZoom(lightboxScrollRef, lightboxZoom, applyLightboxZoom, {
    disabled: !lightboxOpen,
    onGestureStart: markGesture,
  })

  const { suppressClickUntilRef: previewPanSuppressClickUntilRef } = useMermaidScrollPan(previewScrollRef, {
    disabled,
    onPanStart: markGesture,
    attachKey: `${blockId}:${svgRevision}`,
  })

  useMermaidScrollPan(lightboxScrollRef, {
    disabled: !lightboxOpen,
    onPanStart: markGesture,
    attachKey: lightboxOpen,
  })

  const openLightbox = useCallback(() => {
    if (disabled || !previewHostRef.current?.querySelector('svg')) return
    setLightboxZoom(zoom)
    setLightboxOpen(true)
  }, [disabled, zoom])

  const onPreviewClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (disabled) return
      if (Date.now() < previewPanSuppressClickUntilRef.current) return
      if (Date.now() - lastGestureAtRef.current < 450) return
      if ((event.target as HTMLElement).closest('.pm-mermaid-preview-controls')) return
      if (!previewHostRef.current?.querySelector('svg')) return
      openLightbox()
    },
    [disabled, openLightbox, previewPanSuppressClickUntilRef],
  )

  const combinedHostRef = mergeRefs(hostRef, previewHostRef)

  return (
    <>
      <div
        className={[
          'pm-mermaid-preview-viewport',
          disabled ? 'pm-mermaid-preview-viewport--disabled' : '',
          hidden ? 'pm-mermaid-preview-viewport--hidden' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <MermaidPreviewZoomControls
          zoom={zoom}
          onZoomOut={() => bumpZoom(-MERMAID_PREVIEW_ZOOM_STEP, 'preview')}
          onZoomIn={() => bumpZoom(MERMAID_PREVIEW_ZOOM_STEP, 'preview')}
          onReset={() => resetZoom('preview')}
          onExpand={openLightbox}
          expandDisabled={disabled}
        />
        <div
          ref={previewScrollRef}
          className="pm-mermaid-preview-scroll"
          data-testid="pm-mermaid-preview-scroll"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t('editor.mermaid.expandPreviewHint')}
          onClick={onPreviewClick}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openLightbox()
            }
          }}
        >
          <MermaidZoomStage
            zoom={zoom}
            size={previewSize}
            stageClassName="pm-mermaid-preview-stage"
            hostRef={combinedHostRef}
            hostClassName={`pm-mermaid-svg-host mermaid ${RUNTIME_SURFACE_CLASS.host}`}
          />
        </div>
      </div>

      {lightboxOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pm-mermaid-lightbox-backdrop"
              role="presentation"
              data-testid="pm-mermaid-lightbox"
              onMouseDown={stopPmPointer}
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="pm-mermaid-lightbox-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={stopPmPropagation}
                onClick={(event) => event.stopPropagation()}
              >
                <header className="pm-mermaid-lightbox-header">
                  <h2 id={titleId} className="pm-mermaid-lightbox-title">
                    {title}
                  </h2>
                  <button
                    type="button"
                    className="pm-mermaid-lightbox-close"
                    data-testid="pm-mermaid-lightbox-close"
                    aria-label={t('editor.mermaid.lightboxClose')}
                    onClick={() => setLightboxOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <MermaidPreviewZoomControls
                  className="pm-mermaid-lightbox-controls"
                  zoom={lightboxZoom}
                  onZoomOut={() => bumpZoom(-MERMAID_PREVIEW_ZOOM_STEP, 'lightbox')}
                  onZoomIn={() => bumpZoom(MERMAID_PREVIEW_ZOOM_STEP, 'lightbox')}
                  onReset={() => resetZoom('lightbox')}
                />
                <div
                  ref={lightboxScrollRef}
                  className="pm-mermaid-lightbox-scroll"
                  data-testid="pm-mermaid-lightbox-scroll"
                >
                  <MermaidZoomStage
                    zoom={lightboxZoom}
                    size={lightboxSize}
                    stageClassName="pm-mermaid-lightbox-stage"
                    hostRef={lightboxHostRef}
                    hostClassName={`pm-mermaid-svg-host mermaid ${RUNTIME_SURFACE_CLASS.host}`}
                  />
                </div>
              </div>
            </div>,
            resolveOverlayPortalRoot(),
          )
        : null}
    </>
  )
})
