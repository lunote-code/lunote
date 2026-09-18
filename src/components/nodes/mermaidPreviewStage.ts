export type MermaidContentSize = {
  width: number
  height: number
}

export function measureMermaidSvgHost(host: HTMLElement | null): MermaidContentSize | null {
  const svg = host?.querySelector('svg')
  if (!svg) return null

  const box = svg.getBoundingClientRect()
  const width = Math.ceil(Math.max(box.width, svg.scrollWidth, svg.clientWidth))
  const height = Math.ceil(Math.max(box.height, svg.scrollHeight, svg.clientHeight))
  if (width <= 0 || height <= 0) return null

  return { width, height }
}

export function scaledMermaidStageSize(
  size: MermaidContentSize | null,
  zoom: number,
): MermaidContentSize | null {
  if (!size) return null
  return {
    width: Math.ceil(size.width * zoom),
    height: Math.ceil(size.height * zoom),
  }
}
