import { isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { exportBinaryPayload, exportNotePayload } from '../../lib/tauriScopedInvoke'
import { exportBinaryNote, exportNote } from '../../platform/tauri/documentService'

const EXPORT_MAX_PX = 2400
const EXPORT_PADDING = 48

const DEFAULT_SVG_FILENAME = 'lunote-graph.svg'
const DEFAULT_PNG_FILENAME = 'lunote-graph.png'

export type GraphExportSaveContext = {
  dialogTitle: string
  filterName: string
  defaultFilename?: string
  workspaceRoot?: string
}

const INLINE_STYLE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'font-family',
  'font-weight',
  'paint-order',
  'filter',
] as const

const EXPORT_REMOVE_SELECTOR = [
  '.kos-graph-edge-hit',
  '.kos-graph-edge-glow',
  '.kos-graph-edge--preview',
  '[data-testid="kos-graph-link-preview"]',
].join(',')

export async function exportGraphSvg(
  svgElement: SVGSVGElement,
  context?: GraphExportSaveContext,
): Promise<boolean> {
  const prepared = prepareGraphSvgForExport(svgElement)
  const serialized = new XMLSerializer().serializeToString(prepared.svg)
  const filename = context?.defaultFilename ?? DEFAULT_SVG_FILENAME
  return persistGraphExportText(serialized, filename, 'svg', context)
}

/** @deprecated Use exportGraphSvg */
export async function downloadGraphSvg(
  svgElement: SVGSVGElement,
  filename = DEFAULT_SVG_FILENAME,
): Promise<boolean> {
  return exportGraphSvg(svgElement, { dialogTitle: '', filterName: '', defaultFilename: filename })
}

export async function exportGraphPng(
  svgElement: SVGSVGElement,
  context?: GraphExportSaveContext,
): Promise<boolean> {
  const prepared = prepareGraphSvgForExport(svgElement)
  const { width, height, svg } = prepared
  if (width <= 0 || height <= 0) return false

  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  const serialized = new XMLSerializer().serializeToString(svg)
  const svgUrl = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    const panelBg =
      getComputedStyle(document.documentElement).getPropertyValue('--surface-panel').trim() ||
      '#ffffff'
    ctx.fillStyle = panelBg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) return false
    const filename = context?.defaultFilename ?? DEFAULT_PNG_FILENAME
    return persistGraphExportBlob(pngBlob, filename, 'png', context)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** @deprecated Use exportGraphPng */
export async function downloadGraphPng(
  svgElement: SVGSVGElement,
  _width?: number,
  _height?: number,
  filename = DEFAULT_PNG_FILENAME,
): Promise<boolean> {
  return exportGraphPng(svgElement, { dialogTitle: '', filterName: '', defaultFilename: filename })
}

type PreparedGraphSvg = {
  svg: SVGSVGElement
  width: number
  height: number
}

/** Clone live graph SVG for export: inline styles, strip interaction layers, fit full content. */
export function prepareGraphSvgForExport(sourceSvg: SVGSVGElement): PreparedGraphSvg {
  const svg = sourceSvg.cloneNode(true) as SVGSVGElement
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  embedGraphExportStyles(svg, sourceSvg)
  // Inline while trees still match 1:1 — removal happens after styling.
  inlineGraphSvgStyles(sourceSvg, svg)
  reinforceGraphExportStyles(sourceSvg, svg)
  svg.querySelectorAll(EXPORT_REMOVE_SELECTOR).forEach((node) => node.remove())

  const dimensions = fitGraphSvgToContent(svg)
  return { svg, ...dimensions }
}

function embedGraphExportStyles(svg: SVGSVGElement, sourceSvg: SVGSVGElement): void {
  const sampleEdge = sourceSvg.querySelector('.kos-graph-edge')
  const sampleLabel = sourceSvg.querySelector('.kos-graph-node-label')
  const sampleDot = sourceSvg.querySelector('.kos-graph-node-dot')
  const sampleMarker = sourceSvg.querySelector('.kos-graph-edge-marker-path')
  const sampleUnresolved = sourceSvg.querySelector('.kos-graph-edge--unresolved')

  const edgeStroke = sampleEdge ? readComputedColor(sampleEdge, 'stroke') : 'rgba(80, 80, 80, 0.55)'
  const edgeWidth = sampleEdge ? getComputedStyle(sampleEdge).strokeWidth || '1.4' : '1.4'
  const edgeOpacity = sampleEdge ? getComputedStyle(sampleEdge).opacity || '0.78' : '0.78'
  const labelFill = sampleLabel ? readComputedColor(sampleLabel, 'fill') : 'currentColor'
  const dotFill = sampleDot ? readComputedColor(sampleDot, 'fill') : 'currentColor'
  const dotStroke = sampleDot ? readComputedColor(sampleDot, 'stroke') : 'currentColor'
  const markerFill = sampleMarker ? readComputedColor(sampleMarker, 'fill') : edgeStroke
  const dashArray = sampleUnresolved
    ? getComputedStyle(sampleUnresolved).strokeDasharray || '5 4'
    : '5 4'

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
    .kos-graph-edge {
      fill: none;
      stroke: ${edgeStroke};
      stroke-width: ${edgeWidth};
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: ${edgeOpacity};
    }
    .kos-graph-edge--unresolved { stroke-dasharray: ${dashArray}; opacity: 0.66; }
    .kos-graph-edge--embed { opacity: 0.72; }
    .kos-graph-edge-hit,
    .kos-graph-edge-glow,
    .kos-graph-edge--preview { display: none; }
    .kos-graph-edge-marker-path { fill: ${markerFill}; }
    .kos-graph-node-dot { fill: ${dotFill}; stroke: ${dotStroke}; }
    .kos-graph-node-label { fill: ${labelFill}; paint-order: stroke fill; }
    .kos-graph-node-halo { stroke: none; }
  `
  const defs = svg.querySelector('defs')
  if (defs) defs.prepend(style)
  else svg.prepend(style)
}

function reinforceGraphExportStyles(sourceSvg: SVGSVGElement, cloneSvg: SVGSVGElement): void {
  for (const sourceGroup of sourceSvg.querySelectorAll('[data-graph-edge-id]')) {
    const edgeId = sourceGroup.getAttribute('data-graph-edge-id')
    if (!edgeId) continue
    const cloneGroup = cloneSvg.querySelector(`[data-graph-edge-id="${edgeId}"]`)
    if (!cloneGroup) continue
    const sourceEdge = sourceGroup.querySelector('path.kos-graph-edge')
    const cloneEdge = cloneGroup.querySelector('path.kos-graph-edge')
    if (sourceEdge instanceof SVGPathElement && cloneEdge instanceof SVGPathElement) {
      applyPresentationStyles(sourceEdge, cloneEdge)
    }
  }

  for (const sourceNode of sourceSvg.querySelectorAll('[data-graph-node-id]')) {
    const nodeId = sourceNode.getAttribute('data-graph-node-id')
    if (!nodeId) continue
    const cloneNode = cloneSvg.querySelector(`[data-graph-node-id="${nodeId}"]`)
    if (!cloneNode) continue
    for (const selector of ['.kos-graph-node-dot', '.kos-graph-node-ring', '.kos-graph-node-label', '.kos-graph-node-halo']) {
      const sourceEl = sourceNode.querySelector(selector)
      const cloneEl = cloneNode.querySelector(selector)
      if (sourceEl instanceof SVGElement && cloneEl instanceof SVGElement) {
        applyPresentationStyles(sourceEl, cloneEl)
      }
    }
  }

  for (const sourceMarker of sourceSvg.querySelectorAll('.kos-graph-edge-marker-path')) {
    const id = sourceMarker.closest('marker')?.getAttribute('id')
    if (!id) continue
    const cloneMarker = cloneSvg.querySelector(`marker#${CSS.escape(id)} .kos-graph-edge-marker-path`)
    if (sourceMarker instanceof SVGElement && cloneMarker instanceof SVGElement) {
      applyPresentationStyles(sourceMarker, cloneMarker)
    }
  }
}

function inlineGraphSvgStyles(source: Element, clone: Element): void {
  if (source instanceof SVGElement && clone instanceof SVGElement) {
    applyInlineStyles(source, clone)
  }

  const sourceChildren = Array.from(source.children)
  const cloneChildren = Array.from(clone.children)
  for (let i = 0; i < sourceChildren.length; i += 1) {
    const sourceChild = sourceChildren[i]
    const cloneChild = cloneChildren[i]
    if (sourceChild && cloneChild) inlineGraphSvgStyles(sourceChild, cloneChild)
  }
}

function applyInlineStyles(source: SVGElement, target: SVGElement): void {
  const computed = getComputedStyle(source)
  for (const prop of INLINE_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (!isExportableStyleValue(prop, value)) continue
    target.style.setProperty(prop, value)
  }
  const cssVars = ['--kos-graph-folder-color', '--kos-graph-node-tone'] as const
  for (const varName of cssVars) {
    const value = computed.getPropertyValue(varName)
    if (value) target.style.setProperty(varName, value)
  }
}

function applyPresentationStyles(source: SVGElement, target: SVGElement): void {
  const computed = getComputedStyle(source)
  const fill = computed.fill
  if (fill) target.setAttribute('fill', fill)
  const stroke = computed.stroke
  if (isExportableStyleValue('stroke', stroke)) {
    target.setAttribute('stroke', stroke)
  }
  const strokeWidth = computed.strokeWidth
  if (strokeWidth) target.setAttribute('stroke-width', strokeWidth)
  const dash = computed.strokeDasharray
  if (dash && dash !== 'none') target.setAttribute('stroke-dasharray', dash)
  const linecap = computed.strokeLinecap
  if (linecap && linecap !== 'normal') target.setAttribute('stroke-linecap', linecap)
  const linejoin = computed.strokeLinejoin
  if (linejoin && linejoin !== 'normal') target.setAttribute('stroke-linejoin', linejoin)
  const opacity = computed.opacity
  if (opacity && opacity !== '1') target.setAttribute('opacity', opacity)
  if (source instanceof SVGTextElement && computed.fontSize) {
    target.setAttribute('font-size', computed.fontSize)
  }
  applyInlineStyles(source, target)
}

function isExportableStyleValue(prop: string, value: string): boolean {
  if (!value || value === 'none' || value === 'normal') return false
  if (prop === 'stroke' || prop === 'fill') {
    if (value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return false
  }
  return true
}

function readComputedColor(element: Element, prop: 'fill' | 'stroke'): string {
  const value = getComputedStyle(element)[prop === 'fill' ? 'fill' : 'stroke']
  if (value && value !== 'none' && value !== 'transparent') return value
  return prop === 'fill' ? 'none' : 'rgba(80, 80, 80, 0.55)'
}

function fitGraphSvgToContent(svg: SVGSVGElement): { width: number; height: number } {
  const world = svg.querySelector('.kos-graph-world')
  if (!(world instanceof SVGGElement)) {
    const fallbackW = svg.width.baseVal.value || 800
    const fallbackH = svg.height.baseVal.value || 600
    return { width: fallbackW, height: fallbackH }
  }

  world.removeAttribute('transform')

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none'
  host.appendChild(svg)
  document.body.appendChild(host)
  let bbox: DOMRect
  try {
    bbox = world.getBBox()
  } catch {
    bbox = new DOMRect(0, 0, svg.width.baseVal.value || 800, svg.height.baseVal.value || 600)
  } finally {
    document.body.removeChild(host)
  }

  const vbX = bbox.x - EXPORT_PADDING
  const vbY = bbox.y - EXPORT_PADDING
  const vbW = Math.max(bbox.width + EXPORT_PADDING * 2, 1)
  const vbH = Math.max(bbox.height + EXPORT_PADDING * 2, 1)
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)

  const scale = Math.min(EXPORT_MAX_PX / vbW, EXPORT_MAX_PX / vbH, 2)
  const width = Math.max(1, Math.round(vbW * scale))
  const height = Math.max(1, Math.round(vbH * scale))
  return { width, height }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('graph png export failed'))
    image.src = url
  })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('graph export encoding failed'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('graph export encoding failed'))
    reader.readAsDataURL(blob)
  })
}

async function persistGraphExportText(
  content: string,
  defaultFilename: string,
  kind: 'svg' | 'png',
  context?: GraphExportSaveContext,
): Promise<boolean> {
  if (isTauri() && context?.dialogTitle) {
    const picked = await save({
      title: context.dialogTitle,
      defaultPath: defaultFilename,
      filters: [{ name: context.filterName, extensions: [kind] }],
    })
    if (!picked) return false
    await exportNote(exportNotePayload(picked, content, context.workspaceRoot ?? ''))
    return true
  }
  const mime = kind === 'svg' ? 'image/svg+xml;charset=utf-8' : 'image/png'
  downloadBlob(new Blob([content], { type: mime }), defaultFilename)
  return true
}

async function persistGraphExportBlob(
  blob: Blob,
  defaultFilename: string,
  kind: 'svg' | 'png',
  context?: GraphExportSaveContext,
): Promise<boolean> {
  if (isTauri() && context?.dialogTitle) {
    const picked = await save({
      title: context.dialogTitle,
      defaultPath: defaultFilename,
      filters: [{ name: context.filterName, extensions: [kind] }],
    })
    if (!picked) return false
    const dataBase64 = await blobToBase64(blob)
    await exportBinaryNote(exportBinaryPayload(picked, dataBase64, context.workspaceRoot ?? ''))
    return true
  }
  downloadBlob(blob, defaultFilename)
  return true
}
