/**
 * Surface Split Layout — editor ↔ knowledge rail Width driven by runtime.
 * Drag and drop is divided into two stages: preview (only CSS variables) and commit (persistence + OS).
 */
import type { OSKernelTickId } from '../osKernelClock'
import { bumpLiveKernelTick, getCurrentOSKernelTick } from '../osKernelClock'

export const SURFACE_SPLITTER_WIDTH_PX = 4
export const SURFACE_RAIL_MIN_PX = 260
export const SURFACE_RAIL_MAX_PX = 560
export const SURFACE_RAIL_DEFAULT_PX = 300

const STORAGE_KEY = 'knowledgeSurfaceSplitRatio'
const DEFAULT_RATIO = SURFACE_RAIL_DEFAULT_PX / 1000

export type SurfaceSplitIntentSource = 'drag' | 'programmatic'

export type SurfaceSplitIntent = {
  source: SurfaceSplitIntentSource
  ratio: number
}

export type SurfaceSplitLayout = {
  kernelTick: OSKernelTickId
  revision: number
  editorWidth: number
  railWidth: number
  splitRatio: number
  splitAreaWidth: number
  isDragging: boolean
}

let splitAreaWidth = 0
let committedRatio = DEFAULT_RATIO
let previewRatio: number | null = null
let isDragging = false
let layoutRevision = 0
const listeners = new Set<() => void>()

function notifyCommitted(): void {
  layoutRevision += 1
  for (const fn of listeners) {
    fn()
  }
}

function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return committedRatio
  return Math.max(0.12, Math.min(0.55, ratio))
}

function loadPersistedRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return DEFAULT_RATIO
    const n = Number(raw)
    return Number.isFinite(n) ? clampRatio(n) : DEFAULT_RATIO
  } catch {
    return DEFAULT_RATIO
  }
}

function persistRatio(ratio: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio))
  } catch {
    /* quota / private mode */
  }
}

function usableSplitWidth(): number {
  return Math.max(0, splitAreaWidth - SURFACE_SPLITTER_WIDTH_PX)
}

function railWidthFromRatio(ratio: number): number {
  const usable = usableSplitWidth()
  if (usable <= 0) return SURFACE_RAIL_DEFAULT_PX
  const maxRail = Math.min(SURFACE_RAIL_MAX_PX, usable - SURFACE_RAIL_MIN_PX)
  if (maxRail < SURFACE_RAIL_MIN_PX) return Math.min(SURFACE_RAIL_MIN_PX, usable)
  const raw = Math.round(ratio * usable)
  return Math.max(SURFACE_RAIL_MIN_PX, Math.min(maxRail, raw))
}

function buildCommittedLayout(): Omit<SurfaceSplitLayout, 'kernelTick' | 'isDragging'> {
  const railWidth = railWidthFromRatio(committedRatio)
  const usable = usableSplitWidth()
  const editorWidth = Math.max(0, usable - railWidth)
  const splitRatio = usable > 0 ? railWidth / usable : committedRatio
  return {
    revision: layoutRevision,
    editorWidth,
    railWidth,
    splitRatio,
    splitAreaWidth,
  }
}

export function isSurfaceSplitDragging(): boolean {
  return isDragging
}

/** Graph / Backlink pauses recalculation when dragging the splitter bar.*/
export function isSurfaceResizing(): boolean {
  return isDragging
}

export function resetSurfaceSplitLayoutRuntime(): void {
  splitAreaWidth = 0
  committedRatio = loadPersistedRatio()
  previewRatio = null
  isDragging = false
  dragSession = null
  layoutRevision = 0
  listeners.clear()
}

export function restoreSurfaceSplitLayoutFromStorage(): void {
  committedRatio = loadPersistedRatio()
  previewRatio = null
  isDragging = false
  dragSession = null
  notifyCommitted()
}

export function subscribeSurfaceSplitLayout(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSurfaceSplitLayoutRevision(): number {
  return layoutRevision
}

/**
 * Report the total available width of editor+rail in main.
 * During dragging, only splitAreaWidth is updated silently, without notification or recalculation of committed ratio.
 */
export function reportMainSplitAreaWidth(width: number, kernelTick?: OSKernelTickId): boolean {
  const next = Math.max(0, Math.floor(width))
  if (next === splitAreaWidth) return false
  splitAreaWidth = next
  void (kernelTick ?? getCurrentOSKernelTick())
  if (isDragging) return false
  notifyCommitted()
  return true
}

export type SurfaceSplitDragSession = {
  frozenEditorWidth: number
  frozenRailWidth: number
  frozenMainWidth: number
}

let dragSession: SurfaceSplitDragSession | null = null

export function beginSurfaceSplitDrag(session?: SurfaceSplitDragSession): void {
  isDragging = true
  previewRatio = committedRatio
  dragSession = session ?? null
}

export function getSurfaceSplitDragSession(): SurfaceSplitDragSession | null {
  return dragSession
}

/**
 * Drag preview: only updates the memory ratio and returns the preview rail width (for CSS variables).
 * Do not notify, do not write localStorage, do not bump kernel tick.
 */
export function setSurfaceSplitPreview(ratio: number): number {
  previewRatio = clampRatio(ratio)
  return railWidthFromRatio(previewRatio)
}

export function getSurfaceSplitPreviewRailWidth(): number {
  const ratio = previewRatio ?? committedRatio
  return railWidthFromRatio(ratio)
}

export function commitSurfaceSplitLayout(kernelTick?: OSKernelTickId): void {
  if (previewRatio != null) {
    committedRatio = clampRatio(previewRatio)
    persistRatio(committedRatio)
  }
  previewRatio = null
  isDragging = false
  dragSession = null
  const tick = kernelTick ?? bumpLiveKernelTick('knowledge-invalidate')
  void tick
  notifyCommitted()
}

export function cancelSurfaceSplitDrag(): void {
  previewRatio = null
  isDragging = false
  dragSession = null
}

/** Layout committed (used by OS snapshot/Graph). Unchanged during dragging.*/
export function getSurfaceSplitLayout(kernelTick?: OSKernelTickId): SurfaceSplitLayout {
  const tick = kernelTick ?? getCurrentOSKernelTick()
  return {
    kernelTick: tick,
    ...buildCommittedLayout(),
    isDragging,
  }
}

/** @deprecated Only testing/programming; please use preview + commit for dragging.*/
export function setSurfaceSplitIntent(intent: SurfaceSplitIntent, kernelTick?: OSKernelTickId): void {
  if (intent.source === 'drag') {
    beginSurfaceSplitDrag()
    setSurfaceSplitPreview(intent.ratio)
    return
  }
  committedRatio = clampRatio(intent.ratio)
  previewRatio = null
  isDragging = false
  persistRatio(committedRatio)
  void (kernelTick ?? getCurrentOSKernelTick())
  notifyCommitted()
}

export function setSurfaceSplitLayoutProgrammatic(railWidthPx: number, kernelTick?: OSKernelTickId): void {
  const usable = usableSplitWidth()
  committedRatio = usable > 0 ? clampRatio(railWidthPx / usable) : committedRatio
  previewRatio = null
  isDragging = false
  persistRatio(committedRatio)
  void (kernelTick ?? getCurrentOSKernelTick())
  notifyCommitted()
}

export function initSurfaceSplitLayoutRuntime(): void {
  committedRatio = loadPersistedRatio()
  previewRatio = null
  isDragging = false
}

export function applyKosRailWidthCss(el: HTMLElement | null, widthPx: number): void {
  if (!el || isDragging) return
  el.style.setProperty('--kos-rail-width', `${Math.round(widthPx)}px`)
}

export function clearKosRailWidthInline(el: HTMLElement | null): void {
  if (!el) return
  el.style.removeProperty('--kos-rail-width')
}
