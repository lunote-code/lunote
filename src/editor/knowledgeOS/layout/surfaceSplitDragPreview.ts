import type { SurfaceSplitDragSession } from './surfaceSplitLayoutRuntime'
import { SURFACE_SPLITTER_WIDTH_PX } from './surfaceSplitLayoutRuntime'
import { recordTransformPreview } from './surfaceSplitLayoutProfile'

export type { SurfaceSplitDragSession }

const SCALE_MIN = 0.5
const SCALE_MAX = 2.2

function roundPx(n: number): number {
  return Math.round(n)
}

function roundScale(scale: number): number {
  return Math.round(scale * 10000) / 10000
}

/** Drag start: Freeze the grid and the editor column width no longer changes with the preview.*/
export function freezeSplitGridColumns(
  mainEl: HTMLElement,
  session: SurfaceSplitDragSession,
): void {
  const editorW = roundPx(session.frozenEditorWidth)
  const railW = roundPx(session.frozenRailWidth)
  mainEl.style.gridTemplateColumns = `${editorW}px ${SURFACE_SPLITTER_WIDTH_PX}px ${railW}px`
}

export function clearFrozenSplitGrid(mainEl: HTMLElement | null): void {
  mainEl?.style.removeProperty('grid-template-columns')
}

/** Improve rail to be a stable GPU composition layer; freeze the width and change the layout only when committing.*/
export function beginRailDragCompositor(railEl: HTMLElement | null, frozenRailWidth: number): void {
  if (!railEl) return
  const frozen = roundPx(frozenRailWidth)
  railEl.classList.add('kos-right-rail--split-dragging')
  railEl.style.setProperty('--kos-rail-frozen-width', `${frozen}px`)
  railEl.style.transformOrigin = 'right center'
  railEl.style.transform = 'translate3d(0, 0, 0)'
}

/**
 * Only transform (scaleX + translateZ) is used for preview, and width is not changed to avoid layout fallback.
 */
export function applyRailDragPreview(
  railEl: HTMLElement | null,
  previewRailWidth: number,
  frozenRailWidth: number,
): { scaleX: number; frozen: number; preview: number } {
  const frozen = roundPx(frozenRailWidth)
  const preview = roundPx(previewRailWidth)
  if (!railEl || frozen <= 0) {
    return { scaleX: 1, frozen, preview }
  }

  const rawScale = preview / frozen
  const scaleX = roundScale(Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale)))
  const transform =
    Math.abs(scaleX - 1) < 0.0001
      ? 'translate3d(0, 0, 0)'
      : `translate3d(0, 0, 0) scaleX(${scaleX})`

  recordTransformPreview(transform)
  railEl.style.transform = transform

  return { scaleX, frozen, preview }
}

export function clearRailDragPreview(railEl: HTMLElement | null): void {
  if (!railEl) return
  railEl.classList.remove('kos-right-rail--split-dragging')
  railEl.style.removeProperty('--kos-rail-frozen-width')
  railEl.style.removeProperty('transform')
  railEl.style.removeProperty('transform-origin')
}
