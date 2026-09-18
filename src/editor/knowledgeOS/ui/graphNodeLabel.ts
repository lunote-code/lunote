export type GraphNodeLabelOptions = {
  isHighlighted: boolean
  isRouteCenter: boolean
  /** When true, hide peripheral labels until zoomed in. */
  isDenseGraph?: boolean
  isHeadingNode?: boolean
  /** User preference: show labels even when zoomed out after fit. */
  alwaysShowLabels?: boolean
}

export type GraphNodeLabelDisplay = {
  text: string
  visible: boolean
}

function truncateLabel(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label
  if (maxChars <= 1) return '…'
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`
}

function labelLengthForZoom(zoom: number, dense: boolean): number {
  if (zoom < 0.45) return dense ? 8 : 10
  if (zoom < 0.62) return dense ? 10 : 12
  if (zoom < 0.85) return dense ? 12 : 16
  if (zoom < 1.05) return dense ? 14 : 18
  if (zoom < 1.35) return dense ? 18 : 22
  return dense ? 20 : 24
}

/** Zoom-aware label: compact text at fit zoom; tooltip still shows full title. */
export function resolveGraphNodeLabelDisplay(
  label: string,
  zoom: number,
  options: GraphNodeLabelOptions,
): GraphNodeLabelDisplay {
  const showAlways =
    options.alwaysShowLabels || options.isHighlighted || options.isRouteCenter
  const dense = options.isDenseGraph === true

  if (showAlways) {
    return { visible: true, text: truncateLabel(label, labelLengthForZoom(zoom, dense) + 2) }
  }

  if (dense) {
    if (options.isHeadingNode && zoom < 0.95) {
      return zoom < 0.55
        ? { visible: false, text: '' }
        : { visible: true, text: truncateLabel(label, 8) }
    }
    if (zoom < 0.42) {
      return { visible: false, text: '' }
    }
    return { visible: true, text: truncateLabel(label, labelLengthForZoom(zoom, true)) }
  }

  if (zoom < 0.45) {
    return { visible: true, text: truncateLabel(label, 10) }
  }

  if (zoom < 0.6) {
    return { visible: false, text: '' }
  }

  return { visible: true, text: truncateLabel(label, labelLengthForZoom(zoom, false)) }
}
