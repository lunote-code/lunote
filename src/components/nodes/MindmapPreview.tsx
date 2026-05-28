import { memo, useMemo } from 'react'

import { mindmapEdgePath } from '../../editor/mindmap/edgePath'
import { layoutMindmapTree } from '../../editor/mindmap/layoutMindmap'
import { parseMindmapSource } from '../../editor/mindmap/parseMindmap'
import { mindmapTheme } from '../../theme/mindmapTheme'

function levelColor(level: number): { fill: string; stroke: string; text: string } {
  if (level <= 0) {
    return { fill: mindmapTheme.colors.fill1, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level1 }
  }
  if (level === 1) {
    return { fill: mindmapTheme.colors.fill2, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level2 }
  }
  return { fill: mindmapTheme.colors.fill2, stroke: 'var(--color-border-subtle, var(--border-subtle))', text: mindmapTheme.colors.level3 }
}

type MindmapPreviewProps = {
  source: string
}

export const MindmapPreview = memo(function MindmapPreview({ source }: MindmapPreviewProps) {
  const layout = useMemo(() => {
    const root = parseMindmapSource(source)
    if (!root) return null
    return layoutMindmapTree(root)
  }, [source])

  if (!layout) {
    return <div className="pm-mindmap-empty">Unable to parse mindmap structure</div>
  }

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]))

  return (
    <div className="pm-mindmap-preview-host mermaid">
      <svg
        className="pm-mindmap-svg mermaid"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Mind map preview"
      >
        <g className="pm-mindmap-edges">
          {layout.edges.map((e) => {
            const from = nodeById.get(e.from)
            const to = nodeById.get(e.to)
            if (!from || !to) return null
            const x1 = from.x + from.width / 2
            const y1 = from.y + from.height
            const x2 = to.x + to.width / 2
            const y2 = to.y
            return (
              <path
                key={`${e.from}-${e.to}`}
                className="mindmap-link pm-mindmap-link"
                d={mindmapEdgePath(x1, y1, x2, y2)}
                fill="none"
                stroke={mindmapTheme.colors.edge}
                strokeWidth={1.5}
              />
            )
          })}
        </g>
        <g className="pm-mindmap-nodes">
          {layout.nodes.map((n) => {
            const c = levelColor(n.level)
            return (
              <g key={n.id} className="mindmap-node pm-mindmap-node" transform={`translate(${n.x}, ${n.y})`}>
                <rect
                  width={n.width}
                  height={n.height}
                  rx={mindmapTheme.borderRadius}
                  ry={mindmapTheme.borderRadius}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1}
                />
                <text
                  x={n.width / 2}
                  y={n.height / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill={c.text}
                  fontSize={mindmapTheme.fontSize}
                  fontFamily={mindmapTheme.fontFamily}
                >
                  {n.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
})
