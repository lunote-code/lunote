export type RenderPriority = 'visible' | 'interaction' | 'background' | 'idle'

const PRIORITY_RANK: Record<RenderPriority, number> = {
  interaction: 0,
  visible: 1,
  background: 2,
  idle: 3,
}

export function compareRenderPriority(a: RenderPriority, b: RenderPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b]
}

export function isHigherPriority(a: RenderPriority, b: RenderPriority): boolean {
  return compareRenderPriority(a, b) < 0
}

export function maxRenderPriority(a: RenderPriority, b: RenderPriority): RenderPriority {
  return isHigherPriority(a, b) ? a : b
}
