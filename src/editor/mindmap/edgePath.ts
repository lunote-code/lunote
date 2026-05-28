/** Mind map preview edge: smooth Bezier curve (straight line fallback prohibited)*/
export function mindmapEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

export function isCurvedMindmapEdgePath(d: string): boolean {
  return /\sC\s/i.test(d)
}
