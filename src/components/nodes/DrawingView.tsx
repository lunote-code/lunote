import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import {
  DRAWING_COLOR_PRESETS,
  DRAWING_STROKE_WIDTHS,
  type DrawingDocumentPayload,
  type DrawingStroke,
  type DrawingStrokeTool,
  type DrawingUiTool,
  canvasDisplayScale,
  docPointFromViewportPointer,
  drawingDocumentFromNodeAttrs,
  drawingOrigin,
  expandDrawingDocumentForViewport,
  expandDrawingDocumentToIncludePoint,
  renderDrawingToCanvas,
  serializeDrawingFenceBody,
  type ViewportExpansion,
} from '../../editor/drawing/drawingDocument'
import { registerDrawingSerializeFlush } from '../../editor/drawing/drawingSerializeBridge'
import { setInputLayerSource } from '../../editor/inputLayer/inputLayerPaste'
import { resolveOverlayPortalRoot } from '../../lib/overlayPortalRoot'
import { readDrawingCanvasBackgroundColor } from '../../theme-runtime/readThemeCssVar'
import { useI18n } from '../../i18n'
import { DrawingEraserIcon, DrawingHandIcon, DrawingPenIcon } from './drawingToolIcons'

function stopPmPointer(event: ReactMouseEvent | ReactPointerEvent): void {
  event.stopPropagation()
  event.preventDefault()
}

type DrawingNodeAttrs = {
  width?: number
  height?: number
  originX?: number
  originY?: number
  strokes?: string
}

function commitDrawingDocument(
  props: ReactNodeViewProps,
  doc: DrawingDocumentPayload,
  onCommitted?: (doc: DrawingDocumentPayload) => void,
): void {
  const pos = props.getPos()
  if (typeof pos !== 'number') return
  const strokesJson = JSON.stringify(doc.strokes)
  const { ox, oy } = drawingOrigin(doc)
  const current = props.node.attrs as DrawingNodeAttrs
  if (
    current.width === doc.w &&
    current.height === doc.h &&
    (current.originX ?? 0) === ox &&
    (current.originY ?? 0) === oy &&
    current.strokes === strokesJson
  ) {
    onCommitted?.(doc)
    return
  }
  const tr = setInputLayerSource(
    props.editor.view.state.tr.setNodeMarkup(pos, undefined, {
      ...props.node.attrs,
      width: doc.w,
      height: doc.h,
      originX: ox,
      originY: oy,
      strokes: strokesJson,
    }),
    'command',
  )
  props.editor.view.dispatch(tr)
  onCommitted?.(doc)
}

function paintPreviewStroke(
  ctx: CanvasRenderingContext2D,
  doc: DrawingDocumentPayload,
  stroke: DrawingStroke,
): void {
  const { ox, oy } = drawingOrigin(doc)
  if (stroke.points.length === 0) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.width
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'source-over'
    const eraseColor = readDrawingCanvasBackgroundColor()
    ctx.strokeStyle = eraseColor
    ctx.fillStyle = eraseColor
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
  }
  const toLocal = ([x, y]: [number, number]): [number, number] => [x - ox, y - oy]
  if (stroke.points.length === 1) {
    const [x, y] = toLocal(stroke.points[0])
    ctx.beginPath()
    ctx.arc(x, y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.beginPath()
  const [startX, startY] = toLocal(stroke.points[0])
  ctx.moveTo(startX, startY)
  for (let i = 1; i < stroke.points.length; i += 1) {
    const [x, y] = toLocal(stroke.points[i])
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

function restoreDrawingCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = readDrawingCanvasBackgroundColor()
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function syncCanvasBitmapSize(canvas: HTMLCanvasElement, payload: DrawingDocumentPayload): void {
  if (canvas.width !== payload.w) canvas.width = payload.w
  if (canvas.height !== payload.h) canvas.height = payload.h
}

function redrawCanvas(
  canvas: HTMLCanvasElement | null,
  payload: DrawingDocumentPayload,
  previewStroke?: DrawingStroke | null,
): void {
  if (!canvas) return
  syncCanvasBitmapSize(canvas, payload)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  renderDrawingToCanvas(ctx, payload)
  if (previewStroke) paintPreviewStroke(ctx, payload, previewStroke)
  if (previewStroke?.tool === 'eraser') {
    restoreDrawingCanvasBackground(ctx, canvas.width, canvas.height)
  }
}

type DrawingToolbarProps = {
  tool: DrawingUiTool
  color: string
  strokeWidth: number
  onToolChange: (tool: DrawingUiTool) => void
  onColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onClear: () => void
  onExpand?: () => void
  compact?: boolean
}

type DrawingToolButtonProps = {
  tool: DrawingUiTool
  activeTool: DrawingUiTool
  label: string
  testId: string
  onSelect: () => void
  children: ReactNode
}

function DrawingToolButton({ tool, activeTool, label, testId, onSelect, children }: DrawingToolButtonProps) {
  return (
    <button
      type="button"
      className={[
        'pm-drawing-tool',
        'pm-drawing-tool--icon',
        `pm-drawing-tool--${tool}`,
        activeTool === tool ? 'pm-drawing-tool--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
      aria-pressed={activeTool === tool}
      aria-label={label}
      title={label}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

function DrawingToolbar({
  tool,
  color,
  strokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onClear,
  onExpand,
  compact = false,
}: DrawingToolbarProps) {
  const { t } = useI18n()
  return (
    <div
      className={`pm-drawing-toolbar${compact ? ' pm-drawing-toolbar--compact' : ''}`}
      role="toolbar"
      aria-label={t('editor.drawing.toolbarAria')}
      onMouseDown={stopPmPointer}
      onPointerDown={stopPmPointer}
    >
      <div className="pm-drawing-toolbar__group">
        <DrawingToolButton
          tool="pen"
          activeTool={tool}
          label={t('editor.drawing.pen')}
          testId="pm-drawing-tool-pen"
          onSelect={() => onToolChange('pen')}
        >
          <DrawingPenIcon />
        </DrawingToolButton>
        <DrawingToolButton
          tool="hand"
          activeTool={tool}
          label={t('editor.drawing.hand')}
          testId="pm-drawing-tool-hand"
          onSelect={() => onToolChange('hand')}
        >
          <DrawingHandIcon />
        </DrawingToolButton>
        <DrawingToolButton
          tool="eraser"
          activeTool={tool}
          label={t('editor.drawing.eraser')}
          testId="pm-drawing-tool-eraser"
          onSelect={() => onToolChange('eraser')}
        >
          <DrawingEraserIcon />
        </DrawingToolButton>
      </div>
      <span className="pm-drawing-toolbar-sep" aria-hidden="true" />
      <label className={`pm-drawing-field${tool === 'hand' ? ' pm-drawing-field--disabled' : ''}`}>
        <span className="pm-drawing-field-label">{t('editor.drawing.strokeWidth')}</span>
        <select
          className="pm-drawing-select"
          value={strokeWidth}
          disabled={tool === 'hand'}
          onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
        >
          {DRAWING_STROKE_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}px
            </option>
          ))}
        </select>
      </label>
      <span className="pm-drawing-toolbar-sep" aria-hidden="true" />
      <div
        className={`pm-drawing-colors${tool === 'hand' ? ' pm-drawing-colors--disabled' : ''}`}
        role="group"
        aria-label={t('editor.drawing.color')}
      >
        {DRAWING_COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`pm-drawing-color${color === preset ? ' pm-drawing-color--active' : ''}`}
            style={{ backgroundColor: preset }}
            aria-label={preset}
            aria-pressed={color === preset}
            disabled={tool === 'hand'}
            onClick={() => {
              onColorChange(preset)
              onToolChange('pen')
            }}
          />
        ))}
      </div>
      <span className="pm-drawing-toolbar-spacer" />
      <button type="button" className="pm-drawing-tool pm-drawing-tool--danger" onClick={onClear}>
        {t('editor.drawing.clear')}
      </button>
      {onExpand ? (
        <button
          type="button"
          className="pm-drawing-tool pm-drawing-tool--expand"
          data-testid="pm-drawing-expand"
          aria-label={t('editor.drawing.expand')}
          title={t('editor.drawing.expandHint')}
          onClick={onExpand}
        >
          ⤢
        </button>
      ) : null}
    </div>
  )
}

type ViewPan = {
  x: number
  y: number
}

type DrawingCanvasSurfaceProps = {
  doc: DrawingDocumentPayload
  canvasRenderKey: string
  uiTool: DrawingUiTool
  wrapRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null> | ((node: HTMLCanvasElement | null) => void)
  viewPan: ViewPan
  spacePanActive?: boolean
  isPanning?: boolean
  onWrapPointerEnter?: () => void
  onWrapPointerLeave?: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  fullscreen?: boolean
}

function DrawingCanvasSurface({
  doc,
  canvasRenderKey,
  uiTool,
  wrapRef,
  canvasRef,
  viewPan,
  spacePanActive = false,
  isPanning = false,
  onWrapPointerEnter,
  onWrapPointerLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  fullscreen = false,
}: DrawingCanvasSurfaceProps) {
  const cursorTool =
    uiTool === 'hand' || spacePanActive || isPanning ? 'hand' : uiTool

  return (
    <div
      ref={wrapRef}
      className={[
        'pm-drawing-canvas-wrap',
        fullscreen ? 'pm-drawing-canvas-wrap--fullscreen' : '',
        uiTool === 'hand' || spacePanActive ? 'pm-drawing-canvas-wrap--hand' : '',
        spacePanActive ? 'pm-drawing-canvas-wrap--space-pan' : '',
        isPanning ? 'pm-drawing-canvas-wrap--panning' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={fullscreen ? 'pm-drawing-lightbox-canvas-wrap' : 'pm-drawing-canvas-wrap'}
      data-origin-x={doc.ox ?? 0}
      data-origin-y={doc.oy ?? 0}
      onPointerEnter={onWrapPointerEnter}
      onPointerLeave={onWrapPointerLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pm-drawing-canvas-stage"
        style={{ transform: `translate(${viewPan.x}px, ${viewPan.y}px)` }}
      >
        <canvas
          key={canvasRenderKey}
          ref={canvasRef}
          className={['pm-drawing-canvas', `pm-drawing-canvas--${cursorTool}`].join(' ')}
          width={doc.w}
          height={doc.h}
        />
      </div>
    </div>
  )
}

type PanSession = {
  startPanX: number
  startPanY: number
  clientX: number
  clientY: number
}

function shouldPanPointer(uiTool: DrawingUiTool, button: number, spaceHeld: boolean): boolean {
  if (uiTool === 'hand') return button === 0 || button === 1
  if (button === 1) return true
  if (spaceHeld && button === 0) return true
  return false
}

export const DrawingView = function DrawingView(props: ReactNodeViewProps) {
  const { node, editor, selected } = props
  const { t } = useI18n()
  const titleId = useId()
  const inlineWrapRef = useRef<HTMLDivElement | null>(null)
  const lightboxWrapRef = useRef<HTMLDivElement | null>(null)
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lightboxCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activeStrokeRef = useRef<DrawingStroke | null>(null)
  const panSessionRef = useRef<PanSession | null>(null)
  const inlinePanRef = useRef<ViewPan>({ x: 0, y: 0 })
  const lightboxPanRef = useRef<ViewPan>({ x: 0, y: 0 })
  const spaceHeldRef = useRef(false)
  const docRef = useRef<DrawingDocumentPayload>(
    drawingDocumentFromNodeAttrs(node.attrs as DrawingNodeAttrs),
  )
  const committedDocKeyRef = useRef(
    serializeDrawingFenceBody(drawingDocumentFromNodeAttrs(node.attrs as DrawingNodeAttrs)),
  )

  const [tool, setTool] = useState<DrawingUiTool>('pen')
  const [color, setColor] = useState<string>(DRAWING_COLOR_PRESETS[0])
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [inlinePan, setInlinePan] = useState<ViewPan>({ x: 0, y: 0 })
  const [lightboxPan, setLightboxPan] = useState<ViewPan>({ x: 0, y: 0 })
  const [hoveringCanvas, setHoveringCanvas] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const attrs = node.attrs as DrawingNodeAttrs
  const doc = useMemo(
    () => drawingDocumentFromNodeAttrs(attrs),
    [attrs.width, attrs.height, attrs.strokes, attrs.originX, attrs.originY],
  )
  const [displayDoc, setDisplayDoc] = useState<DrawingDocumentPayload>(() =>
    drawingDocumentFromNodeAttrs(node.attrs as DrawingNodeAttrs),
  )
  const displayDocRef = useRef(displayDoc)

  const publishDisplayDoc = useCallback((payload: DrawingDocumentPayload) => {
    docRef.current = payload
    displayDocRef.current = payload
    setDisplayDoc(payload)
  }, [])

  const noteDrawingCommit = useCallback((payload: DrawingDocumentPayload) => {
    committedDocKeyRef.current = serializeDrawingFenceBody(payload)
  }, [])

  const redrawAll = useCallback((payload: DrawingDocumentPayload, previewStroke?: DrawingStroke | null) => {
    redrawCanvas(inlineCanvasRef.current, payload, previewStroke)
    redrawCanvas(lightboxCanvasRef.current, payload, previewStroke)
  }, [])

  const bindInlineCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      inlineCanvasRef.current = node
      if (node) redrawAll(displayDocRef.current)
    },
    [redrawAll],
  )

  const bindLightboxCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      lightboxCanvasRef.current = node
      if (node) redrawAll(displayDocRef.current)
    },
    [redrawAll],
  )

  const blockIdRef = useRef(String((node.attrs as { blockId?: string | null }).blockId ?? '').trim())

  const resolveLiveDrawingNode = useCallback(() => {
    const blockId = blockIdRef.current
    if (blockId) {
      let matched: typeof props.node | null = null
      props.editor.state.doc.descendants((candidate) => {
        if (candidate.type.name !== 'drawingBlock') return
        if (String((candidate.attrs as { blockId?: string | null }).blockId ?? '').trim() === blockId) {
          matched = candidate
          return false
        }
      })
      if (matched) return matched
    }
    const pos = props.getPos()
    if (typeof pos !== 'number') return null
    const atPos = props.editor.state.doc.nodeAt(pos)
    return atPos?.type.name === 'drawingBlock' ? atPos : null
  }, [props.editor, props.getPos, props.node])

  const syncLiveNodeDocument = useCallback(
    (options?: { force?: boolean }) => {
      const liveNode = resolveLiveDrawingNode()
      if (!liveNode) return

      const incoming = drawingDocumentFromNodeAttrs(liveNode.attrs as DrawingNodeAttrs)
      const incomingKey = serializeDrawingFenceBody(incoming)
      const localKey = serializeDrawingFenceBody(docRef.current)
      if (incomingKey === localKey) return

      if (!options?.force && (isDrawing || panSessionRef.current)) {
        if (incoming.strokes.length < docRef.current.strokes.length) {
          activeStrokeRef.current = null
          setIsDrawing(false)
        } else {
          const incomingOx = incoming.ox ?? 0
          const incomingOy = incoming.oy ?? 0
          const localOx = docRef.current.ox ?? 0
          const localOy = docRef.current.oy ?? 0
          if (
            incoming.strokes.length === docRef.current.strokes.length &&
            incoming.w <= docRef.current.w &&
            incoming.h <= docRef.current.h &&
            incomingOx >= localOx &&
            incomingOy >= localOy
          ) {
            return
          }
        }
      }

      publishDisplayDoc(incoming)
      committedDocKeyRef.current = incomingKey
    },
    [isDrawing, publishDisplayDoc, resolveLiveDrawingNode],
  )

  useLayoutEffect(() => {
    displayDocRef.current = displayDoc
    redrawAll(displayDoc)
  }, [displayDoc, redrawAll])

  useLayoutEffect(() => {
    const incoming = drawingDocumentFromNodeAttrs(attrs)
    if ((isDrawing || panSessionRef.current) && incoming.strokes.length >= docRef.current.strokes.length) {
      return
    }
    if (isDrawing || panSessionRef.current) {
      activeStrokeRef.current = null
      setIsDrawing(false)
    }
    const incomingKey = serializeDrawingFenceBody(incoming)
    publishDisplayDoc(incoming)
    committedDocKeyRef.current = incomingKey
  }, [attrs.height, attrs.originX, attrs.originY, attrs.strokes, attrs.width, isDrawing, publishDisplayDoc])

  useLayoutEffect(() => {
    syncLiveNodeDocument({ force: true })
  }, [doc, syncLiveNodeDocument])

  useEffect(() => {
    const syncFromEditor = () => {
      if (panSessionRef.current) return
      const liveNode = resolveLiveDrawingNode()
      if (!liveNode) return
      const incoming = drawingDocumentFromNodeAttrs(liveNode.attrs as DrawingNodeAttrs)
      const incomingKey = serializeDrawingFenceBody(incoming)
      if (incomingKey === serializeDrawingFenceBody(docRef.current)) return
      if (isDrawing && incoming.strokes.length < docRef.current.strokes.length) {
        activeStrokeRef.current = null
        setIsDrawing(false)
      } else if (isDrawing) {
        return
      }
      publishDisplayDoc(incoming)
      committedDocKeyRef.current = incomingKey
    }

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return
      syncFromEditor()
    }

    props.editor.on('transaction', handleTransaction)
    props.editor.on('update', syncFromEditor)
    return () => {
      props.editor.off('transaction', handleTransaction)
      props.editor.off('update', syncFromEditor)
    }
  }, [isDrawing, props.editor, publishDisplayDoc, redrawAll, resolveLiveDrawingNode])

  useEffect(() => {
    if (!lightboxOpen) return
    const frame = requestAnimationFrame(() => {
      redrawAll(docRef.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [lightboxOpen, redrawAll])

  useEffect(() => {
    inlinePanRef.current = inlinePan
  }, [inlinePan])

  useEffect(() => {
    lightboxPanRef.current = lightboxPan
  }, [lightboxPan])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxOpen])

  useEffect(() => {
    const trackSpace = lightboxOpen || hoveringCanvas
    if (!trackSpace) {
      spaceHeldRef.current = false
      setSpaceHeld(false)
      return
    }

    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return
      event.preventDefault()
      spaceHeldRef.current = true
      setSpaceHeld(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
    const onBlur = () => {
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
  }, [hoveringCanvas, lightboxOpen])

  const strokeToolForUi = (uiTool: DrawingUiTool): DrawingStrokeTool =>
    uiTool === 'eraser' ? 'eraser' : 'pen'

  const applyViewportExpansion = useCallback(
    (
      expansion: ViewportExpansion,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
      commit: boolean,
      previewStroke?: DrawingStroke | null,
    ): boolean => {
      const { doc: nextDoc, panAdjust } = expansion
      const { ox: prevOx, oy: prevOy } = drawingOrigin(docRef.current)
      const { ox: nextOx, oy: nextOy } = drawingOrigin(nextDoc)
      if (
        nextDoc.w === docRef.current.w &&
        nextDoc.h === docRef.current.h &&
        nextOx === prevOx &&
        nextOy === prevOy
      ) {
        return false
      }

      docRef.current = nextDoc
      setDisplayDoc(nextDoc)
      const nextPan = {
        x: panRef.current.x + panAdjust.x,
        y: panRef.current.y + panAdjust.y,
      }
      panRef.current = nextPan
      setPan(nextPan)
      redrawAll(nextDoc, previewStroke ?? undefined)
      if (commit) commitDrawingDocument(props, nextDoc, noteDrawingCommit)
      return true
    },
    [noteDrawingCommit, props, redrawAll],
  )

  const syncViewportExpansion = useCallback(
    (
      wrapRef: RefObject<HTMLDivElement | null>,
      canvasRef: RefObject<HTMLCanvasElement | null>,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
      commit: boolean,
      previewStroke?: DrawingStroke | null,
    ) => {
      const wrap = wrapRef.current
      const canvas = canvasRef.current
      if (!wrap || !canvas) return
      const { scaleX, scaleY } = canvasDisplayScale(canvas)
      const expansion = expandDrawingDocumentForViewport(
        docRef.current,
        panRef.current,
        wrap.clientWidth,
        wrap.clientHeight,
        scaleX,
        scaleY,
      )
      applyViewportExpansion(expansion, panRef, setPan, commit, previewStroke)
    },
    [applyViewportExpansion],
  )

  const resolveStrokePoint = useCallback(
    (
      clientX: number,
      clientY: number,
      wrapRef: RefObject<HTMLDivElement | null>,
      canvasRef: RefObject<HTMLCanvasElement | null>,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
      previewStroke?: DrawingStroke | null,
    ): [number, number] | null => {
      const wrap = wrapRef.current
      const canvas = canvasRef.current
      if (!wrap || !canvas) return null
      const rawPoint = docPointFromViewportPointer(
        docRef.current,
        wrap,
        canvas,
        panRef.current,
        clientX,
        clientY,
      )
      const { scaleX, scaleY } = canvasDisplayScale(canvas)
      const expansion = expandDrawingDocumentToIncludePoint(
        docRef.current,
        rawPoint[0],
        rawPoint[1],
        undefined,
        scaleX,
        scaleY,
      )
      applyViewportExpansion(expansion, panRef, setPan, false, previewStroke)
      return rawPoint
    },
    [applyViewportExpansion],
  )

  const beginStroke = useCallback(
    (
      clientX: number,
      clientY: number,
      wrapRef: RefObject<HTMLDivElement | null>,
      canvasRef: RefObject<HTMLCanvasElement | null>,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
      uiTool: DrawingUiTool,
    ) => {
      if (!editor.isEditable || uiTool === 'hand') return
      const point = resolveStrokePoint(clientX, clientY, wrapRef, canvasRef, panRef, setPan)
      if (!point) return
      const stroke: DrawingStroke = {
        tool: strokeToolForUi(uiTool),
        color,
        width: strokeWidth,
        points: [point],
      }
      activeStrokeRef.current = stroke
      setIsDrawing(true)
      redrawAll(docRef.current, stroke)
    },
    [color, editor.isEditable, redrawAll, resolveStrokePoint, strokeWidth],
  )

  const extendStroke = useCallback(
    (
      clientX: number,
      clientY: number,
      wrapRef: RefObject<HTMLDivElement | null>,
      canvasRef: RefObject<HTMLCanvasElement | null>,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
    ) => {
      const stroke = activeStrokeRef.current
      if (!stroke) return
      const point = resolveStrokePoint(clientX, clientY, wrapRef, canvasRef, panRef, setPan, stroke)
      if (!point) return
      const last = stroke.points[stroke.points.length - 1]
      if (last && Math.hypot(last[0] - point[0], last[1] - point[1]) < 0.5) return
      stroke.points.push(point)
      redrawAll(docRef.current, stroke)
    },
    [redrawAll, resolveStrokePoint],
  )

  const finishStroke = useCallback(() => {
    const stroke = activeStrokeRef.current
    activeStrokeRef.current = null
    setIsDrawing(false)
    if (!stroke || stroke.points.length < 1) {
      redrawAll(docRef.current)
      return
    }
    const nextDoc: DrawingDocumentPayload = {
      ...docRef.current,
      strokes: [...docRef.current.strokes, stroke],
    }
    docRef.current = nextDoc
    setDisplayDoc(nextDoc)
    redrawAll(nextDoc)
    commitDrawingDocument(props, nextDoc, noteDrawingCommit)
  }, [noteDrawingCommit, props, redrawAll])

  const flushDrawingToPm = useCallback(() => {
    if (panSessionRef.current) {
      panSessionRef.current = null
      setIsPanning(false)
      syncViewportExpansion(inlineWrapRef, inlineCanvasRef, inlinePanRef, setInlinePan, true)
    }
    const stroke = activeStrokeRef.current
    if (stroke && stroke.points.length >= 1) {
      activeStrokeRef.current = null
      setIsDrawing(false)
      const nextDoc: DrawingDocumentPayload = {
        ...docRef.current,
        strokes: [...docRef.current.strokes, stroke],
      }
      docRef.current = nextDoc
      setDisplayDoc(nextDoc)
      redrawAll(nextDoc)
      commitDrawingDocument(props, nextDoc, noteDrawingCommit)
      return
    }
    activeStrokeRef.current = null
    setIsDrawing(false)
    const localKey = serializeDrawingFenceBody(docRef.current)
    if (localKey !== committedDocKeyRef.current) {
      commitDrawingDocument(props, docRef.current, noteDrawingCommit)
    }
  }, [noteDrawingCommit, props, redrawAll, syncViewportExpansion])

  useEffect(() => {
    return registerDrawingSerializeFlush(editor, flushDrawingToPm)
  }, [editor, flushDrawingToPm])

  const clearCanvas = useCallback(() => {
    const nextDoc: DrawingDocumentPayload = { ...docRef.current, strokes: [] }
    docRef.current = nextDoc
    setDisplayDoc(nextDoc)
    redrawAll(nextDoc)
    commitDrawingDocument(props, nextDoc, noteDrawingCommit)
  }, [noteDrawingCommit, props, redrawAll])

  const beginPan = useCallback((clientX: number, clientY: number, panRef: RefObject<ViewPan>) => {
    panSessionRef.current = {
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      clientX,
      clientY,
    }
    setIsPanning(true)
  }, [])

  const extendPan = useCallback(
    (clientX: number, clientY: number, panRef: RefObject<ViewPan>, setPan: (next: ViewPan) => void) => {
      const session = panSessionRef.current
      if (!session) return
      const next = {
        x: session.startPanX + (clientX - session.clientX),
        y: session.startPanY + (clientY - session.clientY),
      }
      panRef.current = next
      setPan(next)
    },
    [],
  )

  const finishPan = useCallback(() => {
    panSessionRef.current = null
    setIsPanning(false)
  }, [])

  const makePointerHandlers = useCallback(
    (
      wrapRef: RefObject<HTMLDivElement | null>,
      canvasRef: RefObject<HTMLCanvasElement | null>,
      panRef: RefObject<ViewPan>,
      setPan: (next: ViewPan) => void,
    ) => ({
      onWrapPointerEnter: () => setHoveringCanvas(true),
      onWrapPointerLeave: () => setHoveringCanvas(false),
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!editor.isEditable) return

        const panPointer = shouldPanPointer(tool, event.button, spaceHeldRef.current)
        if (panPointer) {
          stopPmPointer(event)
          event.currentTarget.setPointerCapture(event.pointerId)
          beginPan(event.clientX, event.clientY, panRef)
          return
        }

        if (tool === 'hand') return
        stopPmPointer(event)
        event.currentTarget.setPointerCapture(event.pointerId)
        beginStroke(event.clientX, event.clientY, wrapRef, canvasRef, panRef, setPan, tool)
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (panSessionRef.current) {
          stopPmPointer(event)
          extendPan(event.clientX, event.clientY, panRef, setPan)
          return
        }
        if (!isDrawing) return
        stopPmPointer(event)
        extendStroke(event.clientX, event.clientY, wrapRef, canvasRef, panRef, setPan)
      },
      onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (panSessionRef.current) {
          stopPmPointer(event)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          syncViewportExpansion(wrapRef, canvasRef, panRef, setPan, true)
          finishPan()
          return
        }
        if (!isDrawing) return
        stopPmPointer(event)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        finishStroke()
      },
    }),
    [
      beginPan,
      beginStroke,
      editor.isEditable,
      extendPan,
      extendStroke,
      finishPan,
      finishStroke,
      isDrawing,
      syncViewportExpansion,
      tool,
    ],
  )

  const inlinePointerHandlers = makePointerHandlers(inlineWrapRef, inlineCanvasRef, inlinePanRef, setInlinePan)
  const lightboxPointerHandlers = makePointerHandlers(
    lightboxWrapRef,
    lightboxCanvasRef,
    lightboxPanRef,
    setLightboxPan,
  )

  const openLightbox = useCallback(() => {
    if (!editor.isEditable) return
    setLightboxPan({ x: 0, y: 0 })
    lightboxPanRef.current = { x: 0, y: 0 }
    setLightboxOpen(true)
  }, [editor.isEditable])

  const spacePanActive = spaceHeld && (hoveringCanvas || lightboxOpen)

  const blockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
  const canvasRenderKey = serializeDrawingFenceBody(displayDoc)

  return (
    <NodeViewWrapper
      as="div"
      className={`pm-drawing-wrap${selected ? ' pm-drawing-wrap--selected' : ''}`}
      data-drawing-block-id={blockId || undefined}
    >
      <div className="pm-drawing-shell" contentEditable={false}>
        <DrawingToolbar
          tool={tool}
          color={color}
          strokeWidth={strokeWidth}
          onToolChange={setTool}
          onColorChange={setColor}
          onStrokeWidthChange={setStrokeWidth}
          onClear={clearCanvas}
          onExpand={editor.isEditable ? openLightbox : undefined}
        />
        <div className="pm-drawing-body" onMouseDown={stopPmPointer}>
          <DrawingCanvasSurface
            doc={displayDoc}
            canvasRenderKey={canvasRenderKey}
            uiTool={tool}
            wrapRef={inlineWrapRef}
            canvasRef={bindInlineCanvasRef}
            viewPan={inlinePan}
            spacePanActive={spacePanActive}
            isPanning={isPanning}
            {...inlinePointerHandlers}
          />
        </div>
      </div>

      {lightboxOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pm-drawing-lightbox-backdrop"
              role="presentation"
              data-testid="pm-drawing-lightbox"
              onMouseDown={stopPmPointer}
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="pm-drawing-lightbox-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={stopPmPointer}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pm-drawing-lightbox-header">
                  <h3 className="pm-drawing-lightbox-title" id={titleId}>
                    {t('editor.drawing.fullscreenTitle')}
                  </h3>
                  <button
                    type="button"
                    className="pm-drawing-lightbox-close"
                    data-testid="pm-drawing-lightbox-close"
                    aria-label={t('editor.drawing.lightboxClose')}
                    onClick={() => setLightboxOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <DrawingToolbar
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  onToolChange={setTool}
                  onColorChange={setColor}
                  onStrokeWidthChange={setStrokeWidth}
                  onClear={clearCanvas}
                  compact
                />
                <DrawingCanvasSurface
                  doc={displayDoc}
                  canvasRenderKey={canvasRenderKey}
                  uiTool={tool}
                  wrapRef={lightboxWrapRef}
                  canvasRef={bindLightboxCanvasRef}
                  viewPan={lightboxPan}
                  spacePanActive={spacePanActive}
                  isPanning={isPanning}
                  fullscreen
                  {...lightboxPointerHandlers}
                />
              </div>
            </div>,
            resolveOverlayPortalRoot(),
          )
        : null}
    </NodeViewWrapper>
  )
}
