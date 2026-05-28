import { mindmapEdgePath } from '../../../mindmap/edgePath'
import { layoutMindmapTree } from '../../../mindmap/layoutMindmap'
import { parseMindmapSource } from '../../../mindmap/parseMindmap'
import { parseChangedBlock } from '../../incrementalParser'
import type { BlockRenderer, BlockRenderContext, BlockRenderOutput } from '../blockRenderer'
import { mindmapTheme } from '../../../../theme/mindmapTheme'

function levelColor(level: number): { fill: string; stroke: string; text: string } {
  if (level <= 0) {
    return { fill: mindmapTheme.colors.fill1, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level1 }
  }
  if (level === 1) {
    return { fill: mindmapTheme.colors.fill2, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level2 }
  }
  return { fill: mindmapTheme.colors.fill2, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level3 }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildMindmapSvgHtml(source: string): BlockRenderOutput {
  const root = parseMindmapSource(source)
  if (!root) {
    return { kind: 'error', message: 'Unable to parse mindmap structure' }
  }

  const layout = layoutMindmapTree(root)
  if (!layout) {
    return { kind: 'error', message: 'Unable to layout mindmap' }
  }

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]))
  const edgePaths: string[] = []
  for (const e of layout.edges) {
    const from = nodeById.get(e.from)
    const to = nodeById.get(e.to)
    if (!from || !to) continue
    const x1 = from.x + from.width / 2
    const y1 = from.y + from.height
    const x2 = to.x + to.width / 2
    const y2 = to.y
    edgePaths.push(
      `<path class="mindmap-link pm-mindmap-link" d="${mindmapEdgePath(x1, y1, x2, y2)}" fill="none" stroke="${mindmapTheme.colors.edge}" stroke-width="1.5"/>`,
    )
  }

  const nodes: string[] = []
  for (const n of layout.nodes) {
    const c = levelColor(n.level)
    nodes.push(
      `<g class="mindmap-node pm-mindmap-node" transform="translate(${n.x},${n.y})">` +
        `<rect width="${n.width}" height="${n.height}" rx="${mindmapTheme.borderRadius}" ry="${mindmapTheme.borderRadius}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>` +
        `<text x="${n.width / 2}" y="${n.height / 2}" dominant-baseline="middle" text-anchor="middle" fill="${c.text}" font-size="${mindmapTheme.fontSize}" font-family="${mindmapTheme.fontFamily}">${escapeXml(n.label)}</text>` +
        `</g>`,
    )
  }

  const svg =
    `<svg class="pm-mindmap-svg mermaid" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Mind map preview" style="background:var(--color-bg-surface, var(--surface-app))">` +
    `<g class="pm-mindmap-edges">${edgePaths.join('')}</g>` +
    `<g class="pm-mindmap-nodes">${nodes.join('')}</g>` +
    `</svg>`

  return {
    kind: 'html',
    html: `<div class="pm-mindmap-preview-host mermaid">${svg}</div>`,
  }
}

export const mindmapRenderer: BlockRenderer = {
  type: 'mindmap',
  parse(blockId, source) {
    return parseChangedBlock(blockId, source)
  },
  async render(ctx: BlockRenderContext): Promise<BlockRenderOutput> {
    if (ctx.signal.aborted) return { kind: 'cancelled' }
    if (!ctx.source.trim()) return { kind: 'empty' }
    return buildMindmapSvgHtml(ctx.source)
  },
  destroy(_blockId: string) {},
  measure(source) {
    const out = buildMindmapSvgHtml(source)
    if (out.kind !== 'html') return null
    const m = /width="(\d+)" height="(\d+)"/.exec(out.html)
    if (!m) return null
    return { width: Number(m[1]), height: Number(m[2]) }
  },
  defaultPriority() {
    return 'visible'
  },
}
