import type { BlockRenderer, BlockRendererType } from './blockRenderer'

const registry = new Map<BlockRendererType, BlockRenderer>()

export function registerBlockRenderer(renderer: BlockRenderer): void {
  registry.set(renderer.type, renderer)
}

export function getBlockRenderer(type: BlockRendererType): BlockRenderer | undefined {
  return registry.get(type)
}

export function requireBlockRenderer(type: BlockRendererType): BlockRenderer {
  const r = registry.get(type)
  if (!r) throw new Error(`BlockRenderer not registered: ${type}`)
  return r
}

export function listBlockRendererTypes(): BlockRendererType[] {
  return [...registry.keys()]
}

export function clearBlockRendererRegistry(): void {
  registry.clear()
}
