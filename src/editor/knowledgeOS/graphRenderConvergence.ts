import type { NoteGraphEdge, NoteGraphNode } from './types'

export type GraphRenderFrameSample = {
  nodeId: string
  screenX: number
  screenY: number
  edgeSegments: readonly {
    x1: number
    y1: number
    x2: number
    y2: number
  }[]
  labelBox: { x: number; y: number; w: number; h: number }
  visualBBox: { x: number; y: number; w: number; h: number }
  transformMatrix: readonly [number, number, number, number, number, number]
}

const WEIGHT_NODE = 0.4
const WEIGHT_EDGE = 0.2
const WEIGHT_LABEL = 0.2
const WEIGHT_TRANSFORM = 0.2

const MICRO_JITTER_PX = 0.3
const STABILITY_WINDOW_PX = 1.2
const SMOOTH_ALPHA = 0.35

/** Hysteresis: Entering requires score > 0.96 for 2 consecutive frames; exiting requires score < 0.90 for 3 consecutive frames.*/
const HYSTERESIS_ENTER_SCORE = 0.96
const HYSTERESIS_ENTER_FRAMES = 2
const HYSTERESIS_EXIT_SCORE = 0.9
const HYSTERESIS_EXIT_FRAMES = 3

const VISUAL_BBOX_STABLE_FRAMES = 2
const NODE_SCREEN_RADIUS_PX = 10

type ConvergenceHistory = {
  smoothNode: { x: number; y: number } | null
  lastRawNode: { x: number; y: number } | null
  edgesKey: string | null
  labelKey: string | null
  transformKey: string | null
}

let history: ConvergenceHistory = {
  smoothNode: null,
  lastRawNode: null,
  edgesKey: null,
  labelKey: null,
  transformKey: null,
}

let lastConvergenceScore = 0
let scoreStableLatched = false
let hysteresisEnterStreak = 0
let hysteresisExitStreak = 0

let lastVisualBBoxKey: string | null = null
let visualBboxStableStreak = 0
let visualBBoxStableLatched = false

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function componentStability(delta: number): number {
  if (delta < MICRO_JITTER_PX) return 1
  if (delta >= STABILITY_WINDOW_PX) return 0
  return clamp01(1 - (delta - MICRO_JITTER_PX) / (STABILITY_WINDOW_PX - MICRO_JITTER_PX))
}

function smoothPoint(
  prev: { x: number; y: number } | null,
  raw: { x: number; y: number },
): { x: number; y: number } {
  if (!prev) return { x: raw.x, y: raw.y }
  const dx = raw.x - prev.x
  const dy = raw.y - prev.y
  if (Math.hypot(dx, dy) < MICRO_JITTER_PX) return prev
  return {
    x: prev.x + SMOOTH_ALPHA * dx,
    y: prev.y + SMOOTH_ALPHA * dy,
  }
}

function delta2(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
): number {
  if (!a || !b) return STABILITY_WINDOW_PX
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function edgesFingerprint(
  segments: GraphRenderFrameSample['edgeSegments'],
): string {
  return segments
    .map((s) =>
      [
        Math.round(s.x1 * 10) / 10,
        Math.round(s.y1 * 10) / 10,
        Math.round(s.x2 * 10) / 10,
        Math.round(s.y2 * 10) / 10,
      ].join(','),
    )
    .join('|')
}

function labelFingerprint(box: GraphRenderFrameSample['labelBox']): string {
  return [
    Math.round(box.x * 10) / 10,
    Math.round(box.y * 10) / 10,
    Math.round(box.w * 10) / 10,
    Math.round(box.h * 10) / 10,
  ].join(',')
}

function transformFingerprint(
  m: GraphRenderFrameSample['transformMatrix'],
): string {
  return m.map((v) => Math.round(v * 1000) / 1000).join(',')
}

function visualBBoxFingerprint(box: GraphRenderFrameSample['visualBBox']): string {
  return [
    Math.round(box.x * 10) / 10,
    Math.round(box.y * 10) / 10,
    Math.round(box.w * 10) / 10,
    Math.round(box.h * 10) / 10,
  ].join(',')
}

function keyDelta(prev: string | null, next: string): number {
  if (prev == null) return STABILITY_WINDOW_PX
  return prev === next ? 0 : STABILITY_WINDOW_PX
}

function updateScoreHysteresis(score: number): void {
  if (!scoreStableLatched) {
    if (score > HYSTERESIS_ENTER_SCORE) {
      hysteresisEnterStreak += 1
    } else {
      hysteresisEnterStreak = 0
    }
    if (hysteresisEnterStreak >= HYSTERESIS_ENTER_FRAMES) {
      scoreStableLatched = true
      hysteresisExitStreak = 0
    }
    return
  }

  if (score < HYSTERESIS_EXIT_SCORE) {
    hysteresisExitStreak += 1
  } else {
    hysteresisExitStreak = 0
  }
  if (hysteresisExitStreak >= HYSTERESIS_EXIT_FRAMES) {
    scoreStableLatched = false
    hysteresisEnterStreak = 0
  }
}

function updateVisualBBoxStable(sample: GraphRenderFrameSample): void {
  const key = visualBBoxFingerprint(sample.visualBBox)
  if (key === lastVisualBBoxKey) {
    visualBboxStableStreak += 1
  } else {
    visualBboxStableStreak = 1
    lastVisualBBoxKey = key
  }
  visualBBoxStableLatched = visualBboxStableStreak >= VISUAL_BBOX_STABLE_FRAMES
}

export function getRenderConvergenceScore(): number {
  return lastConvergenceScore
}

export function isConvergenceScoreStable(): boolean {
  return scoreStableLatched
}

export function isVisualBBoxStable(): boolean {
  return visualBBoxStableLatched
}

export function resetRenderConvergenceTracker(): void {
  history = {
    smoothNode: null,
    lastRawNode: null,
    edgesKey: null,
    labelKey: null,
    transformKey: null,
  }
  lastConvergenceScore = 0
  scoreStableLatched = false
  hysteresisEnterStreak = 0
  hysteresisExitStreak = 0
  lastVisualBBoxKey = null
  visualBboxStableStreak = 0
  visualBBoxStableLatched = false
}

export type RenderConvergenceFrameResult = {
  score: number
  convergenceScoreStable: boolean
  visualBBoxStable: boolean
}

/** Process one frame of sample: update score, hysteresis latch, visual bbox stable.*/
export function processRenderConvergenceFrame(
  sample: GraphRenderFrameSample,
): RenderConvergenceFrameResult {
  const rawNode = { x: sample.screenX, y: sample.screenY }
  const nextSmoothNode = smoothPoint(history.smoothNode, rawNode)

  let rawDelta = delta2(history.lastRawNode, rawNode)
  if (history.lastRawNode && rawDelta < MICRO_JITTER_PX) {
    rawDelta = 0
  }
  const nodeStability = componentStability(rawDelta)

  const edgesKey = edgesFingerprint(sample.edgeSegments)
  const edgeStability = componentStability(keyDelta(history.edgesKey, edgesKey))

  const labelKey = labelFingerprint(sample.labelBox)
  const labelStability = componentStability(keyDelta(history.labelKey, labelKey))

  const transformKey = transformFingerprint(sample.transformMatrix)
  const transformStability = componentStability(
    keyDelta(history.transformKey, transformKey),
  )

  const score = clamp01(
    nodeStability * WEIGHT_NODE +
      edgeStability * WEIGHT_EDGE +
      labelStability * WEIGHT_LABEL +
      transformStability * WEIGHT_TRANSFORM,
  )

  history = {
    smoothNode: nextSmoothNode,
    lastRawNode: rawNode,
    edgesKey,
    labelKey,
    transformKey,
  }

  lastConvergenceScore = score
  updateScoreHysteresis(score)
  updateVisualBBoxStable(sample)

  return {
    score,
    convergenceScoreStable: scoreStableLatched,
    visualBBoxStable: visualBBoxStableLatched,
  }
}

type Viewport = { x: number; y: number; zoom: number }

const LABEL_CHAR_PX = 6.5
const LABEL_HEIGHT_PX = 18

function unionVisualBBox(
  center: { x: number; y: number },
  labelBox: GraphRenderFrameSample['labelBox'],
): GraphRenderFrameSample['visualBBox'] {
  const x0 = Math.min(labelBox.x, center.x - NODE_SCREEN_RADIUS_PX)
  const y0 = Math.min(labelBox.y, center.y - NODE_SCREEN_RADIUS_PX)
  const x1 = Math.max(labelBox.x + labelBox.w, center.x + NODE_SCREEN_RADIUS_PX)
  const y1 = Math.max(labelBox.y + labelBox.h, center.y + NODE_SCREEN_RADIUS_PX)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** GraphPanel: Collect single frame convergence samples from topology + viewport.*/
export function buildGraphRenderFrameSample(
  nodeId: string,
  nodes: readonly NoteGraphNode[],
  edges: readonly NoteGraphEdge[],
  viewport: Viewport,
  width: number,
  height: number,
  worldGroup?: SVGGElement | null,
): GraphRenderFrameSample | null {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node || width <= 0 || height <= 0) return null

  const ox = width / 2 + viewport.x
  const oy = height / 2 + viewport.y
  const z = viewport.zoom

  const toScreen = (gx: number, gy: number) => ({
    x: ox + gx * z,
    y: oy + gy * z,
  })

  const center = toScreen(node.x, node.y)
  const labelText =
    node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label
  const labelW = Math.max(24, labelText.length * LABEL_CHAR_PX)
  const labelScreen = toScreen(node.x, node.y + 18 / z)

  const labelBox = {
    x: labelScreen.x - labelW / 2,
    y: labelScreen.y - LABEL_HEIGHT_PX,
    w: labelW,
    h: LABEL_HEIGHT_PX,
  }
  const visualBBox = unionVisualBBox(center, labelBox)

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const edgeSegments: {
    x1: number
    y1: number
    x2: number
    y2: number
  }[] = []

  for (const edge of edges) {
    if (edge.from !== nodeId && edge.to !== nodeId) continue
    const a = nodeById.get(edge.from)
    const b = nodeById.get(edge.to)
    if (!a || !b) continue
    const p1 = toScreen(a.x, a.y)
    const p2 = toScreen(b.x, b.y)
    edgeSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
  }

  let transformMatrix: GraphRenderFrameSample['transformMatrix'] = [
    z,
    0,
    0,
    z,
    ox,
    oy,
  ]
  const ctm = worldGroup?.getCTM()
  if (ctm) {
    transformMatrix = [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]
  }

  return {
    nodeId,
    screenX: center.x,
    screenY: center.y,
    edgeSegments,
    labelBox,
    visualBBox,
    transformMatrix,
  }
}
