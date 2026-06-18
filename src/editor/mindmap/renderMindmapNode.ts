import type { MindmapNodeShape } from './parseMindmap'
import { mindmapTheme } from './mindmapTheme'

export type MindmapNodeColors = {
  fill: string
  stroke: string
  text: string
}

export type MindmapNodeLayout = {
  width: number
  height: number
  label: string
  shape: MindmapNodeShape
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mindmapNodeShapeMarkup(n: MindmapNodeLayout, colors: MindmapNodeColors): string {
  const { width, height, label, shape } = n
  const cx = width / 2
  const cy = height / 2
  const safeLabel = escapeXml(label)
  const text =
    `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="${mindmapTheme.fontSize}" font-family="${mindmapTheme.fontFamily}">${safeLabel}</text>`

  if (shape === 'circle') {
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="${width / 2}" ry="${height / 2}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1"/>` +
      text
    )
  }

  const rx =
    shape === 'rect' ? 0 : shape === 'rounded' ? Math.max(mindmapTheme.borderRadius, height / 2) : mindmapTheme.borderRadius

  return (
    `<rect width="${width}" height="${height}" rx="${rx}" ry="${rx}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1"/>` +
    text
  )
}
