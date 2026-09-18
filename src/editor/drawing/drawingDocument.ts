import { readDrawingCanvasBackgroundColor } from '../../theme-runtime/readThemeCssVar'

export const DEFAULT_DRAWING_WIDTH = 640
export const DEFAULT_DRAWING_HEIGHT = 360
export const DRAWING_MIN_DIMENSION = 120
/** Soft guard for corrupt payloads; viewport expansion is otherwise unbounded. */
export const DRAWING_MAX_DIMENSION = 65536

export type DrawingStrokeTool = 'pen' | 'eraser'

/** UI-only tool: hand mode pans the viewport without drawing. */
export type DrawingUiTool = 'pen' | 'hand' | 'eraser'

export type DrawingStroke = {
  tool: DrawingStrokeTool
  color: string
  width: number
  /** Absolute world coordinates (infinite canvas). */
  points: [number, number][]
}

export type DrawingDocumentPayload = {
  /** Bitmap width in world units (grows as the infinite canvas expands). */
  w: number
  h: number
  /** World X mapped to canvas pixel 0 (defaults to 0). */
  ox?: number
  /** World Y mapped to canvas pixel 0 (defaults to 0). */
  oy?: number
  strokes: DrawingStroke[]
}

export const DRAWING_COLOR_PRESETS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea'] as const

export const DRAWING_STROKE_WIDTHS = [2, 4, 8, 16] as const

export function drawingOrigin(doc: DrawingDocumentPayload): { ox: number; oy: number } {
  return { ox: doc.ox ?? 0, oy: doc.oy ?? 0 }
}

export function emptyDrawingDocument(): DrawingDocumentPayload {
  return { w: DEFAULT_DRAWING_WIDTH, h: DEFAULT_DRAWING_HEIGHT, strokes: [] }
}

function clampStoredDimension(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(DRAWING_MIN_DIMENSION, Math.min(DRAWING_MAX_DIMENSION, Math.round(n)))
}

function expandDimension(value: number): number {
  return Math.max(DRAWING_MIN_DIMENSION, Math.round(value))
}

export function clampDrawingDimension(value: number, fallback: number): number {
  return clampStoredDimension(value, fallback)
}

export function expandDrawingDocument(
  doc: DrawingDocumentPayload,
  extra: { left?: number; top?: number; right?: number; bottom?: number },
): DrawingDocumentPayload {
  const left = Math.max(0, Math.round(extra.left ?? 0))
  const top = Math.max(0, Math.round(extra.top ?? 0))
  const right = Math.max(0, Math.round(extra.right ?? 0))
  const bottom = Math.max(0, Math.round(extra.bottom ?? 0))
  if (left === 0 && top === 0 && right === 0 && bottom === 0) return doc

  const { ox, oy } = drawingOrigin(doc)
  return {
    ...doc,
    ox: ox - left,
    oy: oy - top,
    w: expandDimension(doc.w + left + right),
    h: expandDimension(doc.h + top + bottom),
    strokes: doc.strokes,
  }
}

export const DRAWING_VIEWPORT_EXPAND_PADDING = 48

export function canvasDisplayScale(canvas: HTMLCanvasElement): { scaleX: number; scaleY: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    scaleX: rect.width / Math.max(canvas.width, 1),
    scaleY: rect.height / Math.max(canvas.height, 1),
  }
}

export function worldPointToCanvasLocal(
  doc: DrawingDocumentPayload,
  worldX: number,
  worldY: number,
): [number, number] {
  const { ox, oy } = drawingOrigin(doc)
  return [worldX - ox, worldY - oy]
}

export function docPointToViewportLocal(
  doc: DrawingDocumentPayload,
  worldX: number,
  worldY: number,
  viewPan: { x: number; y: number },
  scaleX: number,
  scaleY: number,
): { x: number; y: number } {
  const [localX, localY] = worldPointToCanvasLocal(doc, worldX, worldY)
  return {
    x: viewPan.x + localX * scaleX,
    y: viewPan.y + localY * scaleY,
  }
}

export function docPointFromViewportPointer(
  doc: DrawingDocumentPayload,
  wrap: HTMLElement,
  canvas: HTMLCanvasElement,
  viewPan: { x: number; y: number },
  clientX: number,
  clientY: number,
): [number, number] {
  const wrapRect = wrap.getBoundingClientRect()
  const { scaleX, scaleY } = canvasDisplayScale(canvas)
  const { ox, oy } = drawingOrigin(doc)
  const localX = (clientX - wrapRect.left - viewPan.x) / scaleX
  const localY = (clientY - wrapRect.top - viewPan.y) / scaleY
  return [ox + localX, oy + localY]
}

export function expandDrawingDocumentToIncludePoint(
  doc: DrawingDocumentPayload,
  worldX: number,
  worldY: number,
  padding = DRAWING_VIEWPORT_EXPAND_PADDING,
  scaleX = 1,
  scaleY = 1,
): ViewportExpansion {
  const { ox, oy } = drawingOrigin(doc)
  const left = worldX < ox + padding ? Math.ceil(ox + padding - worldX) : 0
  const top = worldY < oy + padding ? Math.ceil(oy + padding - worldY) : 0
  const right = worldX > ox + doc.w - padding ? Math.ceil(worldX + padding - (ox + doc.w)) : 0
  const bottom = worldY > oy + doc.h - padding ? Math.ceil(worldY + padding - (oy + doc.h)) : 0
  const nextDoc = expandDrawingDocument(doc, { left, top, right, bottom })
  return {
    doc: nextDoc,
    panAdjust: { x: -left * scaleX, y: -top * scaleY },
  }
}

export type ViewportExpansion = {
  doc: DrawingDocumentPayload
  panAdjust: { x: number; y: number }
}

export function applyViewportExpansionState(
  _doc: DrawingDocumentPayload,
  viewPan: { x: number; y: number },
  expansion: ViewportExpansion,
): { doc: DrawingDocumentPayload; viewPan: { x: number; y: number } } {
  return {
    doc: expansion.doc,
    viewPan: {
      x: viewPan.x + expansion.panAdjust.x,
      y: viewPan.y + expansion.panAdjust.y,
    },
  }
}

export function expandDrawingDocumentForViewport(
  doc: DrawingDocumentPayload,
  viewPan: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
  scaleX: number,
  scaleY: number,
  padding = DRAWING_VIEWPORT_EXPAND_PADDING,
): ViewportExpansion {
  const safeScaleX = Math.max(scaleX, 0.001)
  const safeScaleY = Math.max(scaleY, 0.001)
  const { ox, oy } = drawingOrigin(doc)
  const worldLeft = ox + -viewPan.x / safeScaleX
  const worldTop = oy + -viewPan.y / safeScaleY
  const worldRight = ox + (viewportWidth - viewPan.x) / safeScaleX
  const worldBottom = oy + (viewportHeight - viewPan.y) / safeScaleY

  const left = worldLeft < ox + padding ? Math.ceil(ox + padding - worldLeft) : 0
  const top = worldTop < oy + padding ? Math.ceil(oy + padding - worldTop) : 0
  const right = worldRight > ox + doc.w - padding ? Math.ceil(worldRight + padding - (ox + doc.w)) : 0
  const bottom = worldBottom > oy + doc.h - padding ? Math.ceil(worldBottom + padding - (oy + doc.h)) : 0

  const nextDoc = expandDrawingDocument(doc, { left, top, right, bottom })
  return {
    doc: nextDoc,
    panAdjust: {
      x: -left * safeScaleX,
      y: -top * safeScaleY,
    },
  }
}

function normalizeStroke(raw: unknown): DrawingStroke | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<DrawingStroke>
  const tool = row.tool === 'eraser' ? 'eraser' : 'pen'
  const color = typeof row.color === 'string' && row.color.trim() ? row.color.trim() : '#111827'
  const widthRaw = typeof row.width === 'number' ? row.width : Number(row.width)
  const width = Number.isFinite(widthRaw) ? Math.max(1, Math.min(48, widthRaw)) : 4
  const points: [number, number][] = []
  if (Array.isArray(row.points)) {
    for (const point of row.points) {
      if (!Array.isArray(point) || point.length < 2) continue
      const x = Number(point[0])
      const y = Number(point[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      points.push([x, y])
    }
  }
  if (points.length === 0) return null
  return { tool, color, width, points }
}

export function parseDrawingFenceBody(raw: string): DrawingDocumentPayload {
  const trimmed = raw.trim()
  if (!trimmed) return emptyDrawingDocument()
  try {
    const parsed = JSON.parse(trimmed) as Partial<DrawingDocumentPayload>
    const w = clampStoredDimension(parsed.w, DEFAULT_DRAWING_WIDTH)
    const h = clampStoredDimension(parsed.h, DEFAULT_DRAWING_HEIGHT)
    const ox = typeof parsed.ox === 'number' && Number.isFinite(parsed.ox) ? parsed.ox : undefined
    const oy = typeof parsed.oy === 'number' && Number.isFinite(parsed.oy) ? parsed.oy : undefined
    const strokes = Array.isArray(parsed.strokes)
      ? parsed.strokes.map(normalizeStroke).filter((stroke): stroke is DrawingStroke => stroke != null)
      : []
    return { w, h, ...(ox !== undefined ? { ox } : {}), ...(oy !== undefined ? { oy } : {}), strokes }
  } catch {
    return emptyDrawingDocument()
  }
}

export function serializeDrawingFenceBody(doc: DrawingDocumentPayload): string {
  const { ox, oy } = drawingOrigin(doc)
  const payload: Record<string, unknown> = { w: doc.w, h: doc.h, strokes: doc.strokes }
  if (ox !== 0) payload.ox = ox
  if (oy !== 0) payload.oy = oy
  return JSON.stringify(payload)
}

export function parseDrawingNodeAttrs(
  width: unknown,
  height: unknown,
  strokesJson: unknown,
  originX?: unknown,
  originY?: unknown,
): DrawingDocumentPayload {
  const w = clampStoredDimension(width, DEFAULT_DRAWING_WIDTH)
  const h = clampStoredDimension(height, DEFAULT_DRAWING_HEIGHT)
  const ox = typeof originX === 'number' && Number.isFinite(originX) ? originX : undefined
  const oy = typeof originY === 'number' && Number.isFinite(originY) ? originY : undefined
  const raw = typeof strokesJson === 'string' ? strokesJson : '[]'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { w, h, ...(ox !== undefined ? { ox } : {}), ...(oy !== undefined ? { oy } : {}), strokes: [] }
    const strokes = parsed.map(normalizeStroke).filter((stroke): stroke is DrawingStroke => stroke != null)
    return { w, h, ...(ox !== undefined ? { ox } : {}), ...(oy !== undefined ? { oy } : {}), strokes }
  } catch {
    return { w, h, ...(ox !== undefined ? { ox } : {}), ...(oy !== undefined ? { oy } : {}), strokes: [] }
  }
}

export function drawingDocumentFromNodeAttrs(attrs: {
  width?: unknown
  height?: unknown
  strokes?: unknown
  originX?: unknown
  originY?: unknown
}): DrawingDocumentPayload {
  return parseDrawingNodeAttrs(attrs.width, attrs.height, attrs.strokes, attrs.originX, attrs.originY)
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  ox: number,
  oy: number,
  canvasBackground?: string,
): void {
  if (stroke.points.length === 0) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.width
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'source-over'
    const eraseColor = canvasBackground ?? readDrawingCanvasBackgroundColor()
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

export function renderDrawingToCanvas(ctx: CanvasRenderingContext2D, doc: DrawingDocumentPayload): void {
  const { ox, oy } = drawingOrigin(doc)
  const canvasBackground = readDrawingCanvasBackgroundColor()
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = canvasBackground
  ctx.fillRect(0, 0, doc.w, doc.h)
  for (const stroke of doc.strokes) {
    drawStroke(ctx, stroke, ox, oy, canvasBackground)
  }
}

export function canvasPointFromPointer(
  doc: DrawingDocumentPayload,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  options?: { clamp?: boolean },
): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / Math.max(rect.width, 1)
  const scaleY = canvas.height / Math.max(rect.height, 1)
  const { ox, oy } = drawingOrigin(doc)
  const localX = (clientX - rect.left) * scaleX
  const localY = (clientY - rect.top) * scaleY
  const worldX = ox + localX
  const worldY = oy + localY
  if (options?.clamp === false) return [worldX, worldY]
  return [
    Math.max(ox, Math.min(ox + canvas.width, worldX)),
    Math.max(oy, Math.min(oy + canvas.height, worldY)),
  ]
}

/** @deprecated Infinite canvas grows via viewport expansion; manual resize removed. */
export function resizeDrawingDocument(
  doc: DrawingDocumentPayload,
  width: number,
  height: number,
): DrawingDocumentPayload {
  return {
    w: clampStoredDimension(width, doc.w),
    h: clampStoredDimension(height, doc.h),
    ox: doc.ox,
    oy: doc.oy,
    strokes: doc.strokes,
  }
}
